const xml2js = require("xml2js");

module.exports = async (xml) => {
  const parser = new xml2js.Parser({ explicitArray: false });
  return parser.parseStringPromise(xml);
};