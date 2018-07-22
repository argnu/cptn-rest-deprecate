const connector = require(`../db/connector`);
const path = require('path');
const fs = require('fs');

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

module.exports.getTotalQuery = function(table, from, fn_filter) {
  let query = table
  .select(table.count().distinct().as('total'))
  .from(from)

  if (fn_filter) fn_filter(query);

  return connector.execQuery(query.toQuery())
  .then(r => +r.rows[0].total);
}

module.exports.getNombreMes = function(num) {
  let meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  return meses[num-1];
}

module.exports.guardarArchivo = function(tipo, base64) {
  if (!base64) return Promise.resolve(null);
  return new Promise(function(resolve, reject) {
    let nombre = `${tipo}profesional-${Date.now()}.png`;
    let filepath = path.join(__dirname, `../files/${tipo}s/`, nombre);
    console.log(nombre, base64)
    fs.writeFile(filepath, base64.replace(/^data:(.*);base64,/, ""), 'base64', function (e) {
      if (e) reject(e);
      resolve(nombre);
    })
  })
}