module.exports.clone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports.checkNull = function(value) {
  if (typeof value == 'number') return value;
  return value && value.length ? value : null;
}

module.exports.getFloat = function(value) {
  if (typeof value == 'number') return value;
  return value && value.length ? value.replace(',', '.') : null;
}

module.exports.numberOrNull = function(value) {
  if (isNaN(+value)) return null;
  else return +value;
}

module.exports.errorHandler = function(e, req, res) {
  console.error(`Error en ${req.method} ${req.baseUrl}${req.path}`);
  console.log(e)
  if (e.code) res.status(e.code).json({ message: e.message });
  else res.status(500).json({ msg: 'Error en el servidor' });
}