const sql = require('sql');
sql.setDialect('postgres');

module.exports.table = sql.define({
  name: 'tarea_item',
  columns: [
    {
      name: 'id',
      dataType: 'serial',
      primaryKey: true
    },
    {
      name: 'descripcion',
      dataType: 'varchar(255)',
      notNull: true
    }
  ]
});