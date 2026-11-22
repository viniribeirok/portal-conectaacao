// Configuração do importador (CEUs da Prefeitura de São Paulo).
export const ORIGEM = 'ceu_sme';
export const BASE_CEU = 'https://ceu.sme.prefeitura.sp.gov.br';
export const WFS_URL = 'http://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs';
export const WFS_CAMADA = 'geoportal:equipamento_educacao_ceu';
// Identifica o robô para quem administra os sites (boa prática de coleta automática).
export const USER_AGENT = 'ConectaAcaoBot/1.0 (+https://portalconectaacao.vercel.app; projeto extensionista PUC-SP)';
export const INTERVALO_MS = 1500;      // pausa entre requisições ao portal (uso leve)
export const TIMEOUT_MS = 30000;
export const MAX_PAGINAS_LISTAGEM = 150;
