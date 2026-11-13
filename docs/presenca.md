# Etapa 4 — Presença

- `/attendance`: gestores e corretores exibem o QR vigente; gestores consultam os corretores habilitados e corretores consultam a própria presença.
- `/presence`: página pública de entrada do QR, sem confirmação automática. O corretor entra na conta e confirma a própria presença.
- Código compartilhado entre gestores, renovado em intervalos globais de cinco minutos. Só o intervalo vigente é aceito pelo relógio do banco.
- Presença válida por cinco horas. Renovação vigente preserva posição; retorno após expiração entra no final. Não há sessões de abertura/encerramento.
- Token aleatório com validação SHA-256. O valor é restrito e só retorna por função autorizada para a equipe autenticada. Na URL é um fragmento, removido ao abrir; continuidade de login é por aba e destino fixo.
- Confirmação e fila na mesma transação, com bloqueio compartilhado para concorrência. Escrita direta de presença/fila continua proibida. A operação não aceita um identificador de outro corretor.
- Lista atualizada a cada 15 segundos e expira visualmente com o relógio sincronizado. Posição exibida é a ordem dos habilitados, não o número interno persistido.
- QR Code não comprova localização física nem impede compartilhamento por um usuário autorizado.
- Leitura pela câmera do celular; não há leitor interno. O corretor também confirma pelo próprio dispositivo, consumindo o token vigente na tela de presença. Ao testar com celular externo, o endereço do app precisa estar acessível àquele aparelho.
- Distribuição de leads e histórico foram implementados na Etapa 5.

## Validação
- 37 testes aprovados, incluindo 21 verificações de acesso e presença no banco com contas fictícias temporárias.
- Navegador: leitura sem login → login → confirmação, renovação sem mudar posição, consulta após recarga, lista do gestor, erro de código inválido e troca automática no próximo intervalo.
- Computador e celulares sem transbordamento horizontal; nenhum erro de execução observado. Contas e presenças de teste removidas ao final.