const moment = require('moment');
const utils = require('../utils');
const connector = require('../db/connector');
const sql = require('sql');
sql.setDialect('postgres');

const Entidad = require('./Entidad');
const Solicitud = require('./Solicitud');
const Profesional = require('./profesional/Profesional');
const ProfesionalTitulo = require('./profesional/ProfesionalTitulo');
const Empresa = require('./empresa/Empresa');
const TipoEstadoMatricula = require('./tipos/TipoEstadoMatricula');
const Boleta = require('./cobranzas/Boleta');
const ValoresGlobales = require('./ValoresGlobales');
const MatriculaHistorial = require('./MatriculaHistorial');
const Documento = require('./Documento');
const InstitucionTitulo = require('./InstitucionTitulo');


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
      dataType: 'int',
    },
    {
      name: 'updated_by',
      dataType: 'int',
    },
    {
      name: 'created_at',
      dataType: 'timestamptz',
      defaultValue: 'now'
    },
    {
      name: 'updated_at',
      dataType: 'timestamptz',
      defaultValue: 'now'
    },     
    {
      name: 'eliminado',
      dataType: 'boolean',
      defaultValue: false
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
      refColumns: ['id'],
      onUpdate: 'CASCADE'
    },
    {
      table: 'usuario',
      columns: ['updated_by'],
      refColumns: ['id'],
      onUpdate: 'CASCADE'
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
    table.estado.value(matricula.estado),
    table.eliminado.value(false)
  )
  .returning(table.id, table.entidad, table.numeroMatricula, table.solicitud)
  .toQuery()

  return connector.execQuery(query, client)
    .then(r => r.rows[0]);
}

function existMatricula(solicitud) {
  let query = table.select(
    table.id
  )
  .where(table.solicitud.equals(solicitud).and(table.eliminado.equals(false)))
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

  return Boleta.add(boleta, client);
}

function getDocumento(documento, client) {
  return Documento.getAll(documento)
  .then(docs => {
    if (docs.length > 0) return Promise.resolve(docs[0]);
    else return Documento.add(documento, client);
  })
}

function getTipoMatricula(id_profesional) {
  let tipos_mat = ['TECA', 'TEC-', 'IDO'];

  return ProfesionalTitulo.getByProfesional(id_profesional)
  .then(p_titulos => Promise.resolve(p_titulos.map(t => tipos_mat.indexOf(t.titulo.tipo_matricula))))
  .then(tipos => tipos_mat[Math.min(...tipos)]);
}

function getNumeroMatricula(id_profesional, tipo_provisorio) {
  return getTipoMatricula(id_profesional)
  .then(tipo => {
    let query = `
      select max( NULLIF(regexp_replace("numeroMatricula", '\\D','','g'), '')::numeric ) as num
      from matricula
      where "numeroMatricula" LIKE '${tipo_provisorio}%' AND length(regexp_replace("numeroMatricula", '\\D','','g'))=5`

    return connector.execRawQuery(query)
    .then(r => {
      let numero = r.rows[0] ? +r.rows[0].num + 1 : 1;
      return tipo_provisorio + completarConCeros(numero);
    });
  });  
}

module.exports.getNumeroMatricula = getNumeroMatricula;

module.exports.aprobar = function(matricula) {
  let solicitud, matricula_added, valor_inscripcion;


  return existMatricula(matricula.solicitud)
  .then(exist => {
      if (!exist) {
        return Promise.all([
          Solicitud.get(matricula.solicitud),
          ValoresGlobales.getAll({ nombre: 'matriculacion_importe' })
        ])
        .then(rs => {
          solicitud = rs[0];
          valor_inscripcion = rs[1][0].valor;
          return getNumeroMatricula(solicitud.entidad.id, matricula.tipo);
        })
        .then(numero_mat => {
          return connector
          .beginTransaction()
          .then(connection => {
            matricula.solicitud = solicitud.id;
            matricula.entidad = solicitud.entidad.id;
            matricula.estado = matricula.generar_boleta ? 12 : 13; // 12 es 'Pendiente de Pago', 13 es 'Habilitada'
            matricula.numeroMatricula = numero_mat;

            return Solicitud.patch(solicitud.id, { estado: 2 }, connection.client)
            .then(r => addMatricula(matricula, connection.client))
            .then(r => {
              matricula_added = r;
              if (matricula.generar_boleta) {
                return addBoleta(
                  matricula_added.id,
                  matricula.documento.fecha,
                  valor_inscripcion,
                  matricula.delegacion,
                  connection.client
                );
              }
              else return Promise.resolve();
            })
            .then(r => getDocumento(matricula.documento, connection.client))
            .then(documento => MatriculaHistorial.add({
              matricula: matricula_added.id,
              documento: documento.id,
              estado: matricula.generar_boleta ? 12 : 13, // 12 es 'Pendiente de Pago', 13 es 'Habilitada'
              fecha: moment(),
              usuario: matricula.operador
            }, connection.client))
            .then(r => {
              return connector.commit(connection.client)
                .then(r => {
                  connection.done();
                  return matricula_added;
                })
            })
            .catch(e => {
              console.error(e)
              connector.rollback(connection.client);
              connection.done();
              throw Error(e);
            });
          })
        });
      }
      else throw ({ code: 409, message: "Ya existe una matrícula para dicha solicitud" });
  })
}

module.exports.cambiarEstado = function(nuevo_estado) {
  let connection;

  return connector
  .beginTransaction()
  .then(conx => {
    connection = conx;

    return getDocumento(nuevo_estado.documento, connection.client)
    .then(documento =>
      MatriculaHistorial.add({
        matricula: nuevo_estado.matricula,
        documento: documento.id,
        estado: nuevo_estado.estado,
        fecha: moment(),
        usuario: nuevo_estado.operador
      }, connection.client)
    )
    .then(historial => {
      let query = table.update({
        estado: nuevo_estado.estado,
        updated_by: nuevo_estado.operador,
        updated_at: new Date()
      })
      .where(table.id.equals(nuevo_estado.matricula))
      .returning(table.id, table.estado)
      .toQuery();

      return connector.execQuery(query, connection.client)
      .then(r => r.rows[0]);
    })
    .then(matricula => {
      return connector.commit(connection.client)
        .then(r => {
          connection.done();
          return matricula;
        })
    })
  })
}


const select = [
  table.id,
  table.legajo,
  table.numeroMatricula,
  table.fechaResolucion.cast('varchar(10)'),
  table.numeroActa,
  table.entidad,
  table.solicitud,
  table.fechaBaja.cast('varchar(10)'),
  table.observaciones,
  table.notasPrivadas,
  table.asientoBajaF,
  table.codBajaF,
  TipoEstadoMatricula.table.valor.as('estado'),
  Entidad.table.tipo.as('tipoEntidad')
];


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

    if (params.entidad) query.where(table.entidad.equals(params.entidad));

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
  let query = table.select(select)
  .from(
    table.join(TipoEstadoMatricula.table).on(table.estado.equals(TipoEstadoMatricula.table.id))
    .join(Entidad.table).on(table.entidad.equals(Entidad.table.id))
    .leftJoin(Profesional.table).on(table.entidad.equals(Profesional.table.id))
    .leftJoin(Empresa.table).on(table.entidad.equals(Empresa.table.id))
  )
  .where(table.eliminado.equals(false));

  if (params.entidad) query.where(table.entidad.equals(params.entidad));

  if (params.numeroMatricula) query.where(table.numeroMatricula.ilike(`%${params.numeroMatricula}%`));
  if (params.estado && !isNaN(+params.estado)) query.where(table.estado.equals(params.estado));
  if (params.tipoEntidad) query.where(Entidad.table.tipo.equals(params.tipoEntidad));
  if (params.apellido) query.where(Profesional.table.apellido.ilike(`%${params.apellido}%`));
  if (params.dni) query.where(Profesional.table.dni.ilike(`%${params.dni}%`));
  if (params.nombreEmpresa) query.where(Empresa.table.nombre.ilike(`%${params.nombreEmpresa}%`));
  if (params.cuit) query.where(Entidad.table.cuit.ilike(`%${params.cuit}%`));

  if (params.sort) {
    if (params.sort.numeroMatricula) query.order(table.numeroMatricula[params.sort.numeroMatricula]);
    else if (params.sort.estado) query.order(table.estado[params.sort.estado]);
    else if (params.sort.nombreEmpresa) query.order(Empresa.table.nombre[params.sort.nombreEmpresa]);
    else if (params.sort.nombre) query.order(Profesional.table.nombre[params.sort.nombre]);
    else if (params.sort.apellido) query.order(Profesional.table.apellido[params.sort.apellido]);
    else if (params.sort.dni) query.order(Profesional.table.dni[params.sort.dni]);
    else if (params.sort.cuit) query.order(Entidad.table.cuit[params.sort.cuit]);
  }

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
  let query = table.select(...select)
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
  matricula.updated_at = new Date();

  let query = table.update(matricula)
    .where(table.id.equals(id))
    .toQuery();

  return connector.execQuery(query, client);
}