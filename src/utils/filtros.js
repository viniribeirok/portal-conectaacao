import { distanciaKm } from './geo';

/**
 * Filtra e (opcionalmente) ordena por distância a lista de atividades.
 * Extraída do componente Portal como função pura pra poder testar a lógica
 * de busca sem precisar renderizar nada.
 *
 * @param {Array} atividades - lista completa (formato de DADOS_DO_BANCO)
 * @param {Object} filtros
 * @param {string} filtros.busca - texto livre (bairro, nome ou instituição)
 * @param {string} filtros.categoria - 'Todas' ou uma categoria específica
 * @param {string|number} filtros.idade - idade da criança, ou '' pra não filtrar
 * @param {{lat:number, lon:number}|null} filtros.minhaLocalizacao - se
 *        informado, cada atividade ganha um campo `distanciaKm` e a lista
 *        volta ordenada da mais perto pra mais longe.
 */
export function filtrarAtividades(atividades, { busca = '', categoria = 'Todas', idade = '', minhaLocalizacao = null, tipoAtividade = 'todas' } = {}) {
  const termo = busca.trim().toLowerCase();
  const idadeNum = idade === '' ? null : Number(idade);

  let lista = atividades.filter((a) => {
    const bateBusca = !termo
      || a.bairro.toLowerCase().includes(termo)
      || a.nome.toLowerCase().includes(termo)
      || a.instituicao.toLowerCase().includes(termo);
    const bateCategoria = categoria === 'Todas' || a.categoria === categoria;
    const bateIdade = idadeNum === null || (idadeNum >= a.idadeMin && idadeNum <= a.idadeMax);
    const bateTipo = tipoAtividade === 'todas' || (a.tipoAtividade || 'continua') === tipoAtividade;
    return bateBusca && bateCategoria && bateIdade && bateTipo;
  });

  if (minhaLocalizacao) {
    lista = lista.map((a) => {
      const temCoordenadas = typeof a.latitude === 'number' && typeof a.longitude === 'number';
      return {
        ...a,
        distanciaKm: temCoordenadas
          ? distanciaKm(minhaLocalizacao.lat, minhaLocalizacao.lon, a.latitude, a.longitude)
          : undefined,
      };
    });
    // atividades sem coordenada (ex: instituição recém-cadastrada, sem geolocalização
    // ainda) vão pro fim da lista, em vez de quebrar a ordenação.
    lista = [...lista].sort((x, y) => {
      if (x.distanciaKm === undefined && y.distanciaKm === undefined) return 0;
      if (x.distanciaKm === undefined) return 1;
      if (y.distanciaKm === undefined) return -1;
      return x.distanciaKm - y.distanciaKm;
    });
  }

  return lista;
}
