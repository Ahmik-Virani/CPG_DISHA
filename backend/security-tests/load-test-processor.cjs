module.exports = {
  beforeRequest: function(requestParams, context, ee, next) {
    // Add any request preprocessing here
    return next();
  },
  afterResponse: function(requestParams, response, context, ee, next) {
    // Add any response processing here
    return next();
  }
};
