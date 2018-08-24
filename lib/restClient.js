'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _types = require('./types');

var _fetch = require('./fetch');

var _qs = require('qs');

var _qs2 = _interopRequireDefault(_qs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function createIncludedMap(_ref) {
  var json = _ref.json;

  return (json.included || []).reduce(function (accumulator, value) {
    var id = value.id,
        type = value.type;

    accumulator[type] = accumulator[type] || {};
    accumulator[type][id] = value;
    return accumulator;
  }, {});
}

function denormalize(_ref2, included) {
  var id = _ref2.id,
      type = _ref2.type;

  var node = included[type] && included[type][id] || {};
  return denormalizeJsonApiData(node, included);
}

function denormalizeJsonApiData(node, included) {
  if (!node) {
    return {};
  }
  var data = Object.assign({ id: node.id }, node.attributes, node.meta);
  if (node.relationships) {
    Object.keys(node.relationships).forEach(function (key) {
      var relationship = node.relationships[key];
      if (relationship.data) {
        var denormalized = void 0;
        if (Array.isArray(relationship.data)) {
          denormalized = relationship.data.map(function (data) {
            return denormalize(data, included);
          });
        } else {
          denormalized = denormalize(relationship.data, included);
        }
        Object.assign(data, _defineProperty({}, key, denormalized));
      }
    });
  }
  return data;
}

exports.default = function (apiUrl) {
  var httpClient = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _fetch.jsonApiHttpClient;

  /**
   * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
   * @param {String} resource Name of the resource to fetch, e.g. 'posts'
   * @param {Object} params The REST request params, depending on the type
   * @returns {Object} { url, options } The HTTP request parameters
   */
  var convertRESTRequestToHTTP = function convertRESTRequestToHTTP(type, resource, params) {
    var _converters;

    var _params$filter = params.filter,
        include = _params$filter._include,
        filter = _objectWithoutProperties(_params$filter, ['_include']);

    var collectionParams = function collectionParams() {
      var _params$pagination = params.pagination,
          page = _params$pagination.page,
          perPage = _params$pagination.perPage;
      var _params$sort = params.sort,
          field = _params$sort.field,
          order = _params$sort.order;


      return {
        include: include,
        filter: filter,
        page: { number: page, size: perPage },
        sort: order === 'ASC' ? field : '-' + field
      };
    };

    var collectionUrl = function collectionUrl(query) {
      return apiUrl + '/' + resource + '?' + _qs2.default.stringify(query, { indices: false, arrayFormat: 'brackets' });
    };

    var getList = function getList() {
      return { url: collectionUrl(collectionParams()) };
    };

    var getManyReference = function getManyReference() {
      var query = collectionParams();
      query.filter[params.target] = params.id;
      return { url: collectionUrl(query) };
    };

    var getMany = function getMany() {
      return { url: collectionUrl({ filter: { id: params.ids } }) };
    };
    var getOne = function getOne() {
      return { url: apiUrl + '/' + resource + '/' + params.id };
    };

    var create = function create() {
      return {
        url: apiUrl + '/' + resource,
        options: {
          method: 'POST', body: JSON.stringify({ data: { type: resource, attributes: params.data } })
        }
      };
    };

    var update = function update() {
      return {
        url: apiUrl + '/' + resource + '/' + params.id,
        options: {
          method: 'PATCH', body: JSON.stringify({ data: { type: resource, id: params.id, attributes: params.data } })
        }
      };
    };

    var destroy = function destroy() {
      return { url: apiUrl + '/' + resource + '/' + params.id, options: { method: 'DELETE' } };
    };

    var custom = function custom() {
      var action = params.action,
          method = params.method,
          data = params.data;


      return {
        url: apiUrl + '/' + resource + '/' + action, options: { method: method, body: JSON.stringify({ data: data }) }
      };
    };

    var converters = (_converters = {}, _defineProperty(_converters, _types.GET_MANY_REFERENCE, getManyReference), _defineProperty(_converters, _types.GET_LIST, getList), _defineProperty(_converters, _types.GET_MANY, getMany), _defineProperty(_converters, _types.GET_ONE, getOne), _defineProperty(_converters, _types.CREATE, create), _defineProperty(_converters, _types.UPDATE, update), _defineProperty(_converters, _types.DELETE, destroy), _defineProperty(_converters, _types.CUSTOM, custom), _defineProperty(_converters, 'fallback', function fallback() {
      throw new Error('Unsupported fetch action type ' + type);
    }), _converters);

    var _ref3 = (converters[type] || converters.fallback)(),
        url = _ref3.url,
        _ref3$options = _ref3.options,
        options = _ref3$options === undefined ? {} : _ref3$options;

    return { url: url, options: options };
  };

  /**
   * @param {Object} response HTTP response from fetch()
   * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
   * @returns {Object} REST response
   */
  var convertHTTPResponseToREST = function convertHTTPResponseToREST(response, type) {
    var _converters2;

    var denormalize = function denormalize(_ref4) {
      var json = _ref4.json;

      var included = createIncludedMap(response);

      if (Array.isArray(json.data)) {
        return { data: json.data.map(function (node) {
            return denormalizeJsonApiData(node, included);
          }) };
      } else {
        return { data: denormalizeJsonApiData(json.data, included) };
      }
    };

    var paginated = function paginated(resp) {
      return Object.assign(denormalize(resp), { total: resp.json.meta['record_count'] });
    };

    var converters = (_converters2 = {}, _defineProperty(_converters2, _types.GET_MANY_REFERENCE, paginated), _defineProperty(_converters2, _types.GET_LIST, paginated), _defineProperty(_converters2, _types.GET_MANY, denormalize), _defineProperty(_converters2, _types.GET_ONE, denormalize), _defineProperty(_converters2, _types.CREATE, denormalize), _defineProperty(_converters2, _types.UPDATE, denormalize), _defineProperty(_converters2, _types.DELETE, denormalize), _defineProperty(_converters2, _types.CUSTOM, denormalize), _defineProperty(_converters2, 'fallback', function fallback(_ref5) {
      var json = _ref5.json;
      return { data: json.data };
    }), _converters2);

    var result = (converters[type] || converters.fallback)(response);
    return Object.assign(result, response.json.meta && { meta: response.json.meta });
  };

  /**
   * @param {string} type Request type, e.g GET_LIST
   * @param {string} resource Resource name, e.g. "posts"
   * @param {Object} payload Request parameters. Depends on the request type
   * @returns {Promise} the Promise for a REST response
   */
  return function (type, resource, params) {
    var _convertRESTRequestTo = convertRESTRequestToHTTP(type, resource, params),
        url = _convertRESTRequestTo.url,
        options = _convertRESTRequestTo.options;

    return httpClient(url, options).then(function (response) {
      return convertHTTPResponseToREST(response, type);
    });
  };
};