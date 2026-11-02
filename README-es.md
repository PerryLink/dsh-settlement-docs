<div align="center">

# dsh-settlement-docs

> **Repositorio oficial. El único repositorio oficial de este paquete, mantenido por PerryLink. Apache-2.0.**

</div>

Comprueba una lista de documentos de liquidación final de obra contra lo realmente entregado: documentos faltantes, copias insuficientes, firmas/sellos ausentes, documentos opcionales no entregados y tasa de completitud, con exportación a CSV. Todo se ejecuta localmente.

## Documentación completa

La documentación completa (instalación, permisos, ejemplos y solución de problemas) está en [README.md](README.md) y [README-zh.md](README-zh.md).

## Instalación

```sh
dsh plugin --profile <profile> add dsh-settlement-docs
```

## Permisos

Lectura: los CSV de lista y de entrega indicados por el usuario. Escritura: solo `$DSH_HOME/dsh-settlement-docs/exports/`. Red: no. Sistemas externos: ninguno.
