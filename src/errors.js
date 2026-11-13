// Mensagens públicas neutras: detalhes internos não são mostrados ao estabelecimento.
export const errText = (e) => {
  const code = e?.code || '';
  const messages = {
    'auth/configuration-not-found': 'O acesso com Google está temporariamente indisponível. Entre em contato com o suporte.',
    'auth/operation-not-allowed': 'O acesso com Google está temporariamente indisponível. Entre em contato com o suporte.',
    'auth/unauthorized-domain': 'Este endereço ainda não está autorizado para entrar. Avise nosso suporte.',
    'auth/invalid-api-key': 'O serviço de acesso está indisponível. Entre em contato com o suporte.',
    'auth/popup-blocked': 'O navegador bloqueou o login. Permita janelas pop-up para este site e tente novamente.',
    'auth/popup-closed-by-user': 'A entrada foi cancelada. Toque em Continuar com Google para tentar novamente.',
    'auth/cancelled-popup-request': 'Uma tentativa de login já está em andamento.',
    'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet e tente novamente.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/invalid-credential': 'E-mail ou senha inválidos. Confira seus dados e tente novamente.',
    'auth/wrong-password': 'E-mail ou senha inválidos.',
    'auth/user-not-found': 'E-mail ou senha inválidos.',
    'auth/email-already-in-use': 'Este e-mail já possui cadastro. Entre com sua conta.',
    'auth/weak-password': 'Escolha uma senha com pelo menos seis caracteres.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/internal-error': 'Não foi possível entrar agora. Tente novamente em instantes.',
    'permission-denied': 'Você não tem permissão para concluir esta operação.',
    'database/permission-denied': 'Você não tem permissão para concluir esta operação.'
  };
  if (messages[code]) return messages[code];
  if (code.startsWith('api/') && e?.message) return e.message;
  if (code.startsWith('auth/')) return 'Não foi possível entrar. Verifique seus dados ou fale com nosso suporte.';
  if (code.startsWith('database/')) return 'Não foi possível salvar as alterações. Tente novamente.';
  // Erros de validação que são gerados no próprio aplicativo podem ser apresentados.
  if (!code && e instanceof Error) return e.message;
  return 'Não foi possível concluir a operação. Tente novamente.';
};

