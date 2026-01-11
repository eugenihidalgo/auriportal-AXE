# Mapa de Atomicidad - AuriPortal

## Servicios Auditados


### cleaning-engine-service.js
- Path: src/core/master/services/cleaning-engine-service.js
- Operaciones críticas: markCleanStudent, markCleanAllStudents, setRemainingShared
- Pasos persistentes: evento → proyección → sync student_item_state
- Transacciones: unknown (requiere análisis de código)


### place-service.js
- Path: src/services/place-service.js
- Operaciones críticas: activate, deactivate, clean, cleanBulk, cleanAll
- Pasos persistentes: evento → proyección state
- Transacciones: unknown (requiere análisis de código)


### project-service.js
- Path: src/services/project-service.js
- Operaciones críticas: activate, deactivate, clean, cleanBulk, cleanAll
- Pasos persistentes: evento → proyección state
- Transacciones: unknown (requiere análisis de código)


### sponsor-service.js
- Path: src/core/master/services/sponsor-service.js
- Operaciones críticas: link, unlink, care, extendCare, endCare
- Pasos persistentes: evento → proyección state
- Transacciones: unknown (requiere análisis de código)


### level-engine-service.js
- Path: src/core/master/services/level-engine-service.js
- Operaciones críticas: recomputeLevel, recomputePhase
- Pasos persistentes: cálculo → actualización state → emisión señal
- Transacciones: unknown (requiere análisis de código)


### student-domain-integration-service.js
- Path: src/core/student/domains/student-domain-integration-service.js
- Operaciones críticas: activateItem, deactivateItem, cleanItem, updateMetadata
- Pasos persistentes: evento → proyección → señal
- Transacciones: unknown (requiere análisis de código)


## Nota
Este es un análisis preliminar. Se requiere análisis de código para confirmar uso de BEGIN/COMMIT/ROLLBACK.
