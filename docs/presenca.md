# Etapa 4 — Presença

- `/attendance`: gestores exibem o QR vigente e consultam os corretores habilitados; corretores consultam apenas a própria presença.
- `/presence`: página pública de entrada do QR, sem confirmação automática. O corretor entra na conta e confirma a própria presença.
- Código compartilhado entre gestores, renovado em intervalos globais de cinco minutos. Só o intervalo vigente é aceito pelo relógio do banco.
- Presença válida por cinco horas. Renovação vigente preserva posição; retorno após expiração entra no final. Não há sessões de abertura/encerramento.
- Token aleatório com validação SHA-256. O valor é restrito e só retorna por função autorizada para gestores. Na URL é um fragmento, removido ao abrir; continuidade de login é por aba e destino fixo.
- Confirmação e fila na mesma transação, com bloqueio compartilhado para concorrência. Escrita direta de presença/fila continua proibida. A operação não aceita um identificador de outro corretor.
- Lista atualizada a cada 15 segundos e expira visualmente com o relógio sincronizado. Posição exibida é a ordem dos habilitados, não o número interno persistido.
- QR Code não comprova localização física nem impede compartilhamento por um usuário autorizado.
- Leitura pela câmera do celular; não há leitor interno. Ao testar com celular externo, o endereço do app precisa estar acessível àquele aparelho.
- Distribuição de leads e histórico permanecem na Etapa 5, aguardando validação.