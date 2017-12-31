import {
  GET_LIST,
  GET_ONE,
  GET_MANY,
  GET_MANY_REFERENCE,
  CREATE,
  UPDATE,
  DELETE,
  CUSTOM
} from './types';

import { jsonApiHttpClient } from './fetch';
import qs from 'qs';

function createIncludedMap({ json }) {
  return (json.included || []).reduce((accumulator, value) => {
    const { id, type } = value;
    accumulator[type] = accumulator[type] || {};
    accumulator[type][id] = value;
    return accumulator;
  }, {});
}

function denormalize({ id, type }, included) {
  const node = (included[type] && included[type][id]) || {};
  return denormalizeJsonApiData(node, included);
}

function denormalizeJsonApiData(node, included) {
  const data = Object.assign({ id: node.id }, node.attributes, node.meta);
  if (node.relationships) {
    Object.keys(node.relationships).forEach(key => {
      const relationship = node.relationships[key];
      if (relationship.data) {
        let denormalized;
        if (Array.isArray(relationship.data)) {
          denormalized = relationship.data.map(data => denormalize(data, included));
        } else {
          denormalized = denormalize(relationship.data, included)
        }
        Object.assign(data, { [key]: denormalized });
      }
    });
  }
  return data;
}

export default (apiUrl, httpClient = jsonApiHttpClient) => {
  /**
   * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
   * @param {String} resource Name of the resource to fetch, e.g. 'posts'
   * @param {Object} params The REST request params, depending on the type
   * @returns {Object} { url, options } The HTTP request parameters
   */
  const convertRESTRequestToHTTP = (type, resource, params) => {
    const collectionParams = () => {
      const { page, perPage } = params.pagination;
      const { field, order } = params.sort;

      return {
        page: { number: page, size: perPage },
        filter: params.filter,
        sort: (order === 'ASC' ? field : `-${field}`)
      };
    };

    const collectionUrl = (query) => (
      `${apiUrl}/${resource}?${qs.stringify(query, { indices: false, arrayFormat: 'brackets' })}`
    );

    const getList = () => ({ url: collectionUrl(collectionParams())});

    const getManyReference = () => {
      const query = collectionParams();
      query.filter[params.target] = params.id;
      return { url: collectionUrl(query) };
    };

    const getMany = () => ({ url: collectionUrl({ filter: { id: params.ids } })});
    const getOne = () => ({ url: `${apiUrl}/${resource}/${params.id}`});

    const create = () => (
      {
        url: `${apiUrl}/${resource}`,
        options: {
          method: 'POST', body: JSON.stringify({ data: { type: resource, attributes: params.data } })
        }
      }
    );

    const update = () => (
      {
        url: `${apiUrl}/${resource}/${params.id}`,
        options: {
          method: 'PATCH', body: JSON.stringify({ data: { type: resource, id: params.id, attributes: params.data } })
        }
      }
    );

    const destroy = () => ({ url: `${apiUrl}/${resource}/${params.id}`, options: { method: 'DELETE' } });

    const custom = () => {
      const { action, method, data } = params;

      return {
        url: `${apiUrl}/${resource}/${action}`, options: { method, body: JSON.stringify({ data }) }
      };
    };

    const converters = {
      [GET_MANY_REFERENCE]: getManyReference,
      [GET_LIST]: getList,
      [GET_MANY]: getMany,
      [GET_ONE]: getOne,
      [CREATE]: create,
      [UPDATE]: update,
      [DELETE]: destroy,
      [CUSTOM]: custom,
      fallback: () => { throw new Error(`Unsupported fetch action type ${type}`); }
    };

    const { url, options = {} } = (converters[type] || converters.fallback)();
    return { url, options };
  };

  /**
   * @param {Object} response HTTP response from fetch()
   * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
   * @returns {Object} REST response
   */
  const convertHTTPResponseToREST = (response, type) => {
    const denormalize = ({ json }) => {
      const included = createIncludedMap(response);

      if (Array.isArray(json.data)) {
        return { data: json.data.map(node => denormalizeJsonApiData(node, included)) };
      } else {
        return { data: denormalizeJsonApiData(json.data, included) };
      }
    };

    const paginated = resp => Object.assign(denormalize(resp), { total: resp.json.meta['record_count'] });

    const converters = {
      [GET_MANY_REFERENCE]: paginated,
      [GET_LIST]: paginated,
      [GET_MANY]: denormalize,
      [GET_ONE]: denormalize,
      [CREATE]: denormalize,
      [UPDATE]: denormalize,
      [DELETE]: denormalize,
      [CUSTOM]: denormalize,
      fallback: ({ json }) => ({ data: json.data })
    };

    const result = (converters[type] || converters.fallback)(response);
    return Object.assign(result, response.json.meta && { meta: response.json.meta });
  };

  /**
   * @param {string} type Request type, e.g GET_LIST
   * @param {string} resource Resource name, e.g. "posts"
   * @param {Object} payload Request parameters. Depends on the request type
   * @returns {Promise} the Promise for a REST response
   */
  return (type, resource, params) => {
    const { url, options } = convertRESTRequestToHTTP(type, resource, params);
    return httpClient(url, options)
      .then(response => convertHTTPResponseToREST(response, type));
  };
};

