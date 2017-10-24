const config = require('../../../../config.private');
const connector = require('../../../../connector');
const sql = require('sql');
sql.setDialect('postgres');
const model = require('../../../../model');
const sqlserver = require('../../sqlserver');

const consulta = `select c.ID, ITEM, c.APELLIDO,
        c.NOMBRE, VINCULO, c.NUMDOCU, FECHANAC_DATE, INVALIDEZ
        from MAT_CAJA c inner join MATRICULAS m
        on c.ID=m.ID        
        where c.ID between @offset and @limit`;

function makeJob(i, total, page_size) {
    if (i < total) {
        let offset = i + page_size;
        return sqlserver.query(consulta, i, offset)
            .then(beneficiarios => {
                if (beneficiarios) {
                   nuevosBeneficiarios = beneficiarios.map(beneficiario => createBeneficiario(beneficiario));
                   return Promise.all(nuevosBeneficiarios).then(res =>
                    makeJob(offset + 1, total, page_size)
                  );
                }
                else return makeJob(offset + 1, total, page_size);
            })
            .catch(error => {
                console.log('ERROR', error);
            })
    }
}

function createBeneficiario(beneficiario) {
  return model.Matricula.getMigracion(beneficiario['ID'])
  .then(matricula => {
    let nuevoBeneficiario = {};
    nuevoBeneficiario.profesional = matricula.entidad;
    nuevoBeneficiario.apellido = beneficiario['APELLIDO'];
    nuevoBeneficiario.nombre = beneficiario['NOMBRE'];
    nuevoBeneficiario.vinculo = beneficiario['VINCULO'];
    nuevoBeneficiario.dni = beneficiario['NUMDOCU'];
    nuevoBeneficiario.fechaNacimiento = beneficiario['FECHANAC_DATE'];
    nuevoBeneficiario.invalidez = beneficiario['INVALIDEZ'];
    return model.BeneficiarioCaja.addBeneficiario(nuevoBeneficiario);
  });
}


module.exports.migrar = function () {
    console.log('Migrando beneficiarios de matrìculas...');
    let limites = 'select MIN(ID) as min, MAX(ID) as max from MAT_CAJA';
    return sqlserver.query(limites)
        .then(resultado => {
            if (resultado[0]) {
                let min = resultado[0]['min'];
                let max = resultado[0]['max'];
                return makeJob(min, max, 100);
            }
            else return;
        })
}