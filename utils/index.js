module.exports.clone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports.checkNull = function(value) {
  if (typeof value == 'number') return value;
  return value && value.length ? value : null;
}

module.exports.checkFecha = function(value) {
  return value && value.length ? value : null;
}

module.exports.getFloat = function(value) {
  if (typeof value == 'number') return value;
  return value && value.length ? parseFloat(value.replace(',', '.')) : null;
}

module.exports.numberOrNull = function(value) {
  if (isNaN(+value)) return null;
  else return +value;
}

module.exports.errorHandler = function(e, req, res) {
  if (e.code) res.status(e.code).json({ message: e.message });
  else { 
    if (!e.code) console.error(e);
    console.error(`Error en ${req.method} ${req.baseUrl}${req.path}`);
    res.status(500).json({ msg: 'Error en el servidor' });
  }
}

module.exports.seqPromises = function(promises) {
  return promises.reduce((previous_prom, current_prom) => {
    return previous_prom.then(current_prom)
  }, Promise.resolve());  
}