<div align="center">

# dsh-settlement-docs

> **Repositório oficial. O único repositório oficial deste pacote, mantido por PerryLink. Apache-2.0.**

</div>

Confere uma lista de documentos de liquidação final de obra com o que foi realmente entregue: documentos ausentes, cópias insuficientes, assinaturas/carimbos ausentes, documentos opcionais não entregues e taxa de completude, com exportação para CSV. Tudo roda localmente.

## Documentação completa

A documentação completa (instalação, permissões, exemplos e solução de problemas) está em [README.md](README.md) e [README-zh.md](README-zh.md).

## Instalação

```sh
dsh plugin --profile <profile> add dsh-settlement-docs
```

## Permissões

Leitura: os CSVs de lista e de entrega indicados pelo usuário. Escrita: apenas `$DSH_HOME/dsh-settlement-docs/exports/`. Rede: não. Sistemas externos: nenhum.
