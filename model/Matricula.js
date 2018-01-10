const moment = require('moment');
const connector = require('../connector');
const sql = require('sql');
sql.setDialect('postgres');

const utils = require(`${__base}/utils`);
const Solicitud = require('./Solicitud');
const Profesional = require('./profesional/Profesional');
const Empresa = require('./empresa/Empresa');
const Entidad = require('./Entidad');
const TipoEstadoMatricula = require('./tipos/TipoEstadoMatricula');
const Boleta = require('./cobranzas/Boleta');
const ValoresGlobales = require('./ValoresGlobales');


const table = sql.define({
  name: 'matricula',
  columns: [{
      name: 'id',
      dataType: 'serial',
      primaryKey: true
    },
    {
      name: 'legajo',
      dataType: 'int',
    },
    {
      name: 'numeroMatricula',
      dataType: 'varchar(20)'
    },
    {
      name: 'numeroMatriculaCPAGIN',
      dataType: 'varchar(20)'
    },
    {
      name: 'entidad',
      dataType: 'int',
      notNull: true
    },
    {
      name: 'solicitud',
      dataType: 'int'
    },
    {
      name: 'fechaResolucion',
      dataType: 'date'
    },
    {
      name: 'numeroActa',
      dataType: 'varchar(50)'
    },
    {
      name: 'fechaBaja',
      dataType: 'date'
    },
    {
      name: 'observaciones',
      dataType: 'text'
    },
    {
      name: 'notasPrivadas',
      dataType: 'text'
    },
    {
      name: 'asientoBajaF',
      dataType: 'varchar(2)'
    },
    {
      name: 'codBajaF',
      dataType: 'varchar(20)'
    },
    {
      name: 'estado',
      dataType: 'int',
      notNull: true
    },
    {
      name: 'idMigracion',
      dataType: 'int'
    },
    {
      name: 'created_by',
      dataType: 'varchar(45)',
    },
    {
      name: 'updated_by',
      dataType: 'varchar(45)',
    }     
  ],

  foreignKeys: [{
      table: 'entidad',
      columns: ['entidad'],
      refColumns: ['id']
    },
    {
      table: 'solicitud',
      columns: ['solicitud'],
      refColumns: ['id']
    },
    {
      table: 't_estadomatricula',
      columns: ['estado'],
      refColumns: ['id']
    },
    {
      table: 'usuario',
      columns: ['created_by'],
      refColumns: ['id']
    },
    {
      table: 'usuario',
      columns: ['updated_by'],
      refColumns: ['id']
    }     
  ]
});

module.exports.table = table;

function addMatriculaMigracion(matricula, client) {
  let query = table.insert(
    table.legajo.value(matricula.legajo),
    table.idMigracion.value(matricula.idMigracion),
    table.entidad.value(matricula.entidad),
    table.solicitud.value(matricula.solicitud),
    table.fechaResolucion.value(utils.checkNull(matricula.fechaResolucion)),
    table.numeroActa.value(matricula.numeroActa),
    table.numeroMatricula.value(matricula.numeroMatricula),
    table.fechaBaja.value(utils.checkNull(matricula.fechaBaja)),
    table.observaciones.value(matricula.observaciones),
    table.notasPrivadas.value(matricula.notasPrivadas),
    table.asientoBajaF.value(matricula.asientoBajaF),
    table.codBajaF.value(matricula.codBajaF),
    table.estado.value(matricula.estado)
  ).returning(table.id).toQuery()

  return connector.execQuery(query, client)
    .then(r => r.rows[0]);
}

module.exports.addMatriculaMigracion = addMatriculaMigracion;


function addMatricula(matricula, client) {
  let query = table.insert(
    table.created_by.value(matricula.operador),
    table.updated_by.value(matricula.operador),
    table.entidad.value(matricula.entidad),
    table.solicitud.value(matricula.solicitud),
    table.numeroMatricula.value(matricula.numeroMatricula),
    table.fechaResolucion.value(utils.checkNull(matricula.fechaResolucion)),
    table.numeroActa.value(matricula.numeroActa),
    table.estado.value(matricula.estado)
  )
  .returning(table.id, table.entidad, table.numeroMatricula,
    table.solicitud, table.fechaResolucion, table.numeroActa
  )
  .toQuery()

  return connector.execQuery(query, client)
    .then(r => r.rows[0]);
}

function existMatricula(solicitud) {
  let query = table.select(
    table.id
  ).where(table.solicitud.equals(solicitud))
  .toQuery();

  return connector.execQuery(query)
  .then(r => r.rows.length != 0);
}


// NO SE SI CUATRO NUMS O CINCO
function completarConCeros(numero) {
    let result = numero.toString();
    let ceros = '0'.repeat(5 - result.length);
    return ceros + result;
}

function getNumeroMatricula(tipo) {
  tipo = tipo ? tipo : 'TECA';

  let query = `
    select max( NULLIF(regexp_replace("numeroMatricula", '\\D','','g'), '')::numeric ) as num
    from matricula
    where "numeroMatricula" LIKE '${tipo}%' AND length(regexp_replace("numeroMatricula", '\\D','','g'))=5`

  return connector.execRawQuery(query)
    .then(r => {
      let numero = r.rows[0] ? +r.rows[0].num + 1 : 1;
      return tipo + completarConCeros(numero);
    });
}

module.exports.getNumeroMatricula = getNumeroMatricula;


function addBoleta(id, fecha, importe, delegacion, client) {
  let boleta = {
    matricula: id,
    tipo_comprobante: 18,  //18 ES PRI
    fecha: fecha,  //MISMA FECHA QUE EL PAGO
    total: importe, 
    estado: 1,   //1 ES 'Pendiente de Pago'
    fecha_vencimiento: moment(fecha, 'DD/MM/YYYY').add(15, 'days'),
    fecha_update: fecha,
    delegacion: delegacion,
    items: [{
      item: 1,
      descripcion: `Derecho de inscripción profesional`,
      importe: importe
    }]    
  }
  
  return Boleta.addBoleta(boleta, client);
}

module.exports.aprobar = function(matricula) {
  let solicitud;
  let estado;
  let matricula_added;

  return existMatricula(matricula.solicitud)
  .then(exist => {
      if (!exist) {
        Promise.all([
          Solicitud.get(matricula.solicitud),
          getNumeroMatricula(matricula.tipo),
          ValoresGlobales.getAll({ nombre: 'inscripcion_matricula' })
        ])
        .then(([solicitud_get, numero_nueva, valores_inscripcion]) => {
          solicitud = solicitud_get;
          let valor_inscripcion = valores_inscripcion[0].valor;

          return connector
          .beginTransaction()
          .then(connection => {
            matricula.solicitud = solicitud.id;
            matricula.entidad = solicitud.entidad.id;
            matricula.estado = 12; // 12 es 'Pendiente de Pago'
            matricula.numeroMatricula = numero_nueva;            

            return Solicitud.patch(solicitud.id, { estado: 'aprobada' }, connection.client)  
            .then(r => addMatricula(matricula, connection.client))
            .then(r => {
              matricula_added = r;
              if (matricula.generar_boleta) {
                return addBoleta(
                  matricula_added.id, 
                  matricula.fechaResolucion, 
                  valor_inscripcion, 
                  matricula.delegacion, 
                  connection.client
                );
              }
              else Promise.resolve();
            })
            .then(r => {
              return connector.commit(connection.client)
                .then(r => {
                  connection.done();
                  return matricula_added;
                })                            
            })
            .catch(e => {
              connector.rollback(connection.client);
              connection.done();
              throw Error(e);
            });
          })
        });
      }
      else throw ({ code: 400, message: "Ya existe una matrícula para dicha solicitud" });
  })
}


const select = {
  atributes: [
    table.id, table.legajo, table.numeroMatricula,
    TipoEstadoMatricula.table.valor.as('estado'),
    table.fechaResolucion, table.numeroActa,
    table.entidad, table.solicitud,
    table.fechaBaja, table.observaciones,
    table.notasPrivadas, table.asientoBajaF,
    table.codBajaF,
    Entidad.table.tipo.as('tipoEntidad')
  ]
};


function getTotal(params) {
  let query;
  if (!params) {
    query = table.select(table.count().as('total')).from(table);
  }
  else {
    query = table.select(
      table.count(table.id).as('total')
    ).from(
      table.join(TipoEstadoMatricula.table).on(table.estado.equals(TipoEstadoMatricula.table.id))
      .join(Entidad.table).on(table.entidad.equals(Entidad.table.id))
      .leftJoin(Profesional.table).on(table.entidad.equals(Profesional.table.id))
      .leftJoin(Empresa.table).on(table.entidad.equals(Empresa.table.id))      
    );

    if (params.numeroMatricula) query.where(table.numeroMatricula.ilike(`%${params.numeroMatricula}%`));
    if (params.estado && !isNaN(+params.estado)) query.where(table.estado.equals(params.estado));
    if (params.tipoEntidad) query.where(Entidad.table.tipo.equals(params.tipoEntidad));
    if (params.apellido) query.where(Profesional.table.apellido.ilike(`%${params.apellido}%`));
    if (params.dni) query.where(Profesional.table.dni.ilike(`%${params.dni}%`));
    if (params.nombreEmpresa) query.where(Empresa.table.nombre.ilike(`%${params.nombreEmpresa}%`));
    if (params.cuit) query.where(Entidad.table.cuit.ilike(`%${params.cuit}%`));
  }

  return connector.execQuery(query.toQuery())
  .then(r => +r.rows[0].total);
}


module.exports.getAll = function (params) {
  let matriculas = [];
  let query = table.select(
    ...select.atributes
  ).from(
    table.join(TipoEstadoMatricula.table).on(table.estado.equals(TipoEstadoMatricula.table.id))
    .join(Entidad.table).on(table.entidad.equals(Entidad.table.id))
    .leftJoin(Profesional.table).on(table.entidad.equals(Profesional.table.id))
    .leftJoin(Empresa.table).on(table.entidad.equals(Empresa.table.id))    
  );

  if (params.numeroMatricula) query.where(table.numeroMatricula.ilike(`%${params.numeroMatricula}%`));
  if (params.estado && !isNaN(+params.estado)) query.where(table.estado.equals(params.estado));
  if (params.tipoEntidad) query.where(Entidad.table.tipo.equals(params.tipoEntidad));
  if (params.apellido) query.where(Profesional.table.apellido.ilike(`%${params.apellido}%`));
  if (params.dni) query.where(Profesional.table.dni.ilike(`%${params.dni}%`));
  if (params.nombreEmpresa) query.where(Empresa.table.nombre.ilike(`%${params.nombreEmpresa}%`));
  if (params.cuit) query.where(Entidad.table.cuit.ilike(`%${params.cuit}%`));

  if (params.limit) query.limit(+params.limit);
  if (params.limit && params.offset) query.offset(+params.offset);

  return connector.execQuery(query.toQuery())
    .then(r => {
      matriculas = r.rows;
      let proms = matriculas.map(m => {
        if (m.tipoEntidad == 'profesional') return Profesional.get(m.entidad)
        else if (m.tipoEntidad == 'empresa') return Empresa.get(m.entidad);
      });

      return Promise.all(proms)
        .then(rs => {
          rs.forEach((r, i) => {
            matriculas[i].entidad = r;
            delete(matriculas[i].tipoEntidad);
          });
          return Promise.all([
                  getTotal(params),
                  getTotal()
                ]).then(([totalQuery, total]) => ({ total, totalQuery, resultados: matriculas }))
        })
    })
}

module.exports.get = function (id) {
  let solicitud = {};
  let query = table.select(...select.atributes)
                    .from(
                      table.join(TipoEstadoMatricula.table).on(table.estado.equals(TipoEstadoMatricula.table.id))
                      .join(Entidad.table).on(table.entidad.equals(Entidad.table.id))
                      .leftJoin(Profesional.table).on(table.entidad.equals(Profesional.table.id))
                      .leftJoin(Empresa.table).on(table.entidad.equals(Empresa.table.id))
                    )
                    .where(table.id.equals(id))
                    .toQuery();

  return connector.execQuery(query)
    .then(r => {
      matricula = r.rows[0];
      if (!matricula) throw ({ code: 404, message: "No existe el recurso solicitado" });
      if (matricula.tipoEntidad == 'profesional') return Profesional.get(matricula.entidad)
      else if (matricula.tipoEntidad == 'empresa') return Empresa.get(matricula.entidad);
    })
    .then(r => {
      matricula.entidad = r;
      delete(matricula.tipoEntidad);
      return matricula;
    })
}

module.exports.getMigracion = function (id, empresa) {
  let solicitud = {};
  let query = table.select(table.star())
    .from(table.join(Entidad.table).on(table.entidad.equals(Entidad.table.id)))
    .where(
      table.idMigracion.equals(id)
      .and(Entidad.table.tipo.equals(empresa ? 'empresa' : 'profesional'))
    )
    .toQuery();
    
  return connector.execQuery(query)
    .then(r => r.rows[0]);
}

module.exports.patch = function (id, matricula, client) {
  let query = table.update(matricula)
    .where(table.id.equals(id))
    .toQuery();
    
  return connector.execQuery(query, client);
}