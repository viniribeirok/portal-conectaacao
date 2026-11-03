import { useState, useEffect, useMemo } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, X, LogOut, ShieldCheck, Building2, ArrowLeft, Eye, EyeOff,
  Upload, FileText, Check, Mail, Clock, Inbox, Save, CalendarDays,
} from 'lucide-react';
import { TIPOS_INSTITUICAO, FORM_VAZIO } from '../data/instituicoes';
import { CATEGORIAS_FORM, STATUS_OPCOES, STATUS_COR_MAP, ICONE_CATEGORIA } from '../data/atividades';
import {
  carregarTodasInstituicoes, criarPerfil, carregarPerfil, urlDocumento,
  adicionarInstituicao, editarInstituicao, removerInstituicao,
  carregarTurmasDaInstituicao, salvarTurmasDaInstituicao,
  instituicaoAprovada, atualizarStatusInstituicao, instituicaoTemCoordenadas,
} from '../data/repositorio';
import { geocodificarEndereco } from '../lib/geocodificacao';
import { formatarQuando, eventoJaPassou } from '../utils/eventos';
import { supabase } from '../lib/supabase';
import { enviarEmailSimulado, carregarEmailsEnviados } from '../lib/email';
import { storage } from '../lib/storage';

function lerArquivoComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

// Traduz os erros mais comuns do banco para algo que dê pra entender e agir.
function explicarErroSalvar(e) {
  const m = (e && e.message) || '';
  if (/idade_m(in|ax)|idades_check/i.test(m)) return 'as idades precisam estar entre 0 e 99 anos, e a máxima não pode ser menor que a mínima';
  if (/column .* does not exist|schema cache/i.test(m)) return 'o banco ainda não tem as colunas novas — rode o SQL de migração no Supabase e espere 1 minuto';
  if (/row-level security|permission denied/i.test(m)) return 'sua conta não tem permissão para essa alteração';
  return m || 'erro desconhecido';
}

const FORM_INSTITUICAO_VAZIO = { nome: '', tipo: 'ONG', whatsapp: '', endereco: '', bairro: '', cep: '' };

// Campos de posição no mapa gravados na instituição a partir do resultado da geocodificação.
function camposDeLocalizacao(geo) {
  return geo
    ? { latitude: geo.latitude, longitude: geo.longitude, precisaoLocalizacao: geo.precisao }
    : { latitude: null, longitude: null, precisaoLocalizacao: null };
}

function mensagemLocalizacao(geo) {
  if (!geo) return 'Não consegui localizar o endereço no mapa. Confira rua, número e bairro e use "Localizar no mapa" de novo. Enquanto isso, as turmas aparecem na lista, mas sem pino no mapa.';
  if (geo.precisao === 'endereco') return 'Endereço localizado no mapa.';
  if (geo.precisao === 'rua') return 'Localizada pela rua — o número exato não foi encontrado no mapa, então o pino pode ficar um pouco deslocado.';
  return 'Posição aproximada (centro do bairro/CEP) — pra ficar mais exata, confira rua e número.';
}

/** Formulário de dados da instituição — usado pelo admin (criar/editar
 * qualquer uma) e pela própria instituição (editar só os seus dados; nesse
 * caso `editando` é sempre true e os campos de e-mail/senha não aparecem,
 * já que criar login é coisa só do admin). */
function FormularioInstituicao({ formInst, setFormInst, editando, formInstEmail, setFormInstEmail, formInstSenha, setFormInstSenha, erro, onSalvar, onCancelar, salvando }) {
  return (
    <div className="pn-form">
      <div className="pn-form-top">
        <h3>{editando ? 'Editar instituição' : 'Nova instituição'}</h3>
        <button onClick={onCancelar} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }} aria-label="Fechar"><X size={16} /></button>
      </div>
      <div className="pn-campo"><label>Nome</label><input type="text" value={formInst.nome} onChange={(e) => setFormInst({ ...formInst, nome: e.target.value })} placeholder="Nome da instituição" /></div>
      <div className="pn-campo"><label>Tipo</label><select value={formInst.tipo} onChange={(e) => setFormInst({ ...formInst, tipo: e.target.value })}>{TIPOS_INSTITUICAO.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      <div className="pn-campo"><label>WhatsApp</label><input type="text" value={formInst.whatsapp} onChange={(e) => setFormInst({ ...formInst, whatsapp: e.target.value })} placeholder="Ex: 5511999990000" /></div>
      <div className="pn-campo"><label>Endereço</label><input type="text" value={formInst.endereco} onChange={(e) => setFormInst({ ...formInst, endereco: e.target.value })} /></div>
      <div className="pn-campo-dupla">
        <div className="pn-campo"><label>Bairro</label><input type="text" value={formInst.bairro} onChange={(e) => setFormInst({ ...formInst, bairro: e.target.value })} /></div>
        <div className="pn-campo"><label>CEP</label><input type="text" value={formInst.cep} onChange={(e) => setFormInst({ ...formInst, cep: e.target.value })} placeholder="opcional" /></div>
      </div>
      {erro && <p className="pn-erro-form">{erro}</p>}
      <div className="pn-form-acoes">
        <button className="pn-btn primario" onClick={onSalvar} disabled={salvando}><Save size={14} /> {salvando ? 'Localizando endereço…' : 'Salvar'}</button>
        <button className="pn-btn secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

export default function PainelGestao({ voltar }) {
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [todasInstituicoes, setTodasInstituicoes] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [modoAuth, setModoAuth] = useState('entrar');

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erroAuth, setErroAuth] = useState('');
  const [enviandoAuth, setEnviandoAuth] = useState(false);

  const [reg, setReg] = useState({ nome: '', tipo: 'ONG', email: '', senha: '', confirmar: '', whatsapp: '', endereco: '', bairro: '', cep: '' });
  const [arquivoDoc, setArquivoDoc] = useState(null); // { nome, tipo, conteudo }
  const [erroArquivo, setErroArquivo] = useState('');
  const [cadastroEnviado, setCadastroEnviado] = useState(false);

  const instituicoesAprovadas = useMemo(() => todasInstituicoes.filter(instituicaoAprovada), [todasInstituicoes]);

  function nomeInstituicao(id) { return todasInstituicoes.find((i) => i.id === id)?.nome || id; }

  // Qualquer falha de rede/servidor numa ação (promessa sem tratamento) vira um aviso na tela.
  useEffect(() => {
    const aoFalhar = (ev) => {
      console.error(ev.reason);
      setAvisoInst(`Erro ao falar com o servidor: ${ev.reason?.message || 'tente de novo'}`);
    };
    window.addEventListener('unhandledrejection', aoFalhar);
    return () => window.removeEventListener('unhandledrejection', aoFalhar);
  }, []);

  // Uma ONG só entra no painel com o cadastro aprovado.
  function mensagemAcessoOng(u, lista) {
    const inst = lista.find((i) => i.id === u.instituicaoId);
    if (!inst) return 'Essa instituição não existe mais no sistema.';
    if (inst.status === 'pendente') return 'Seu cadastro ainda está em análise. Você recebe um e-mail assim que for avaliado.';
    if (inst.status === 'recusada') return `Seu cadastro não foi aprovado.${inst.motivoRecusa ? ' Motivo: ' + inst.motivoRecusa : ''}`;
    return null;
  }

  async function montarUsuario(authUser) {
    const perfil = await carregarPerfil(authUser.id);
    if (!perfil) return null;
    return { email: authUser.email, papel: perfil.papel, instituicaoId: perfil.instituicaoId };
  }

  // Ao abrir: recupera a sessão do Supabase (se a pessoa já estava logada) e carrega as instituições.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const lista = await carregarTodasInstituicoes();
        setTodasInstituicoes(lista);
        if (data.session) {
          const u = await montarUsuario(data.session.user);
          if (u && !(u.papel === 'ong' && mensagemAcessoOng(u, lista))) setUsuario(u);
          else await supabase.auth.signOut();
        }
      } catch (e) {
        console.error(e);
      }
      setCarregandoSessao(false);
    })();
  }, []);

  async function entrar() {
    if (enviandoAuth) return;
    setErroAuth(''); setEnviandoAuth(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) { setErroAuth('E-mail ou senha incorretos.'); return; }
      const u = await montarUsuario(data.user);
      if (!u) { await supabase.auth.signOut(); setErroAuth('Essa conta não tem acesso ao painel.'); return; }
      const lista = await carregarTodasInstituicoes();
      setTodasInstituicoes(lista);
      if (u.papel === 'ong') {
        const aviso = mensagemAcessoOng(u, lista);
        if (aviso) { await supabase.auth.signOut(); setErroAuth(aviso); return; }
      }
      setUsuario(u);
    } finally {
      setEnviandoAuth(false);
    }
  }

  async function selecionarArquivo(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    setErroArquivo('');
    if (arquivo.size > 2 * 1024 * 1024) { setErroArquivo('O arquivo precisa ter até 2 MB.'); return; }
    try {
      const conteudo = await lerArquivoComoBase64(arquivo);
      setArquivoDoc({ nome: arquivo.name, tipo: arquivo.type, conteudo });
    } catch (e2) {
      setErroArquivo('Não deu pra ler esse arquivo. Tenta outro.');
    }
  }

  function traduzirErroAuth(msg = '') {
    if (/already registered/i.test(msg)) return 'Já existe uma conta com esse e-mail.';
    if (/password/i.test(msg)) return 'A senha não foi aceita. Use pelo menos 6 caracteres.';
    if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
    return `Não foi possível criar a conta: ${msg}`;
  }

  // Cadastro de ONG: cria o login no Supabase, envia o documento, grava a instituição como "pendente" e o perfil.
  async function cadastrarOng() {
    if (enviandoAuth) return;
    if (!reg.nome.trim()) { setErroAuth('Dá um nome pra instituição.'); return; }
    if (!reg.email.trim().includes('@')) { setErroAuth('Digita um e-mail válido.'); return; }
    if (reg.senha.length < 6) { setErroAuth('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (reg.senha !== reg.confirmar) { setErroAuth('As senhas não são iguais.'); return; }
    if (!reg.whatsapp.trim()) { setErroAuth('Informa um WhatsApp de contato.'); return; }
    if (!arquivoDoc) { setErroAuth('Anexa um documento que comprove a instituição (estatuto, CNPJ, etc.).'); return; }

    setErroAuth(''); setEnviandoAuth(true);
    try {
      const emailLimpo = reg.email.trim().toLowerCase();
      const { data: cadastro, error: erroCadastro } = await supabase.auth.signUp({ email: emailLimpo, password: reg.senha });
      if (erroCadastro) { setErroAuth(traduzirErroAuth(erroCadastro.message)); return; }
      if (!cadastro.session) {
        setErroAuth('O Supabase está exigindo confirmação de e-mail. Desative "Confirm email" em Authentication → Providers → Email.');
        return;
      }
      const uid = cadastro.user.id;
      try {
        const resposta = await fetch(arquivoDoc.conteudo);
        const arquivo = await resposta.blob();
        const caminho = `${uid}/${Date.now()}-${arquivoDoc.nome.replace(/[^\w.\-]+/g, '_')}`;
        const { error: erroUpload } = await supabase.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivoDoc.tipo || undefined });
        if (erroUpload) throw erroUpload;

        // Sem latitude/longitude por enquanto — o endereço é localizado no mapa quando o admin aprova.
        const { nova } = await adicionarInstituicao({
          nome: reg.nome.trim(), tipo: reg.tipo, whatsapp: reg.whatsapp.trim(), endereco: reg.endereco.trim(),
          bairro: reg.bairro.trim(), cep: reg.cep.trim(), emailContato: emailLimpo, ownerId: uid,
          documento: { nome: arquivoDoc.nome, path: caminho },
        }, 'pendente');
        await criarPerfil({ userId: uid, papel: 'ong', instituicaoId: nova.id });
      } catch (e) {
        console.error(e);
        await supabase.auth.signOut();
        setErroAuth(`Não foi possível concluir o cadastro: ${e.message || 'erro desconhecido'}.`);
        return;
      }
      await supabase.auth.signOut();
      setReg({ nome: '', tipo: 'ONG', email: '', senha: '', confirmar: '', whatsapp: '', endereco: '', bairro: '', cep: '' });
      setArquivoDoc(null);
      setCadastroEnviado(true);
    } finally {
      setEnviandoAuth(false);
    }
  }

  async function sair() {
    try { await supabase.auth.signOut(); } catch (e) { /* segue */ }
    setUsuario(null); setEmail(''); setSenha(''); setModoAuth('entrar'); setCadastroEnviado(false);
    try { setTodasInstituicoes(await carregarTodasInstituicoes()); } catch (e) { /* segue */ }
  }

  // Abre o documento anexado (o arquivo é privado: o link é gerado na hora e vale por 10 minutos).
  async function baixarDocumento(inst) {
    const janela = window.open('', '_blank');
    try {
      const url = await urlDocumento(inst.documento.path);
      if (janela) janela.location.href = url; else window.location.href = url;
    } catch (e) {
      if (janela) janela.close();
      throw e;
    }
  }

  // ------------------------------------------- cadastros pendentes (admin) --
  const [abaAdmin, setAbaAdmin] = useState('turmas'); // 'turmas' | 'pendentes' | 'instituicoes'
  const [recusandoId, setRecusandoId] = useState(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [emailsEnviados, setEmailsEnviados] = useState([]);
  const [mostrarEmails, setMostrarEmails] = useState(false);
  const [avisoInst, setAvisoInst] = useState('');
  const [localizandoId, setLocalizandoId] = useState(null);

  const pendentes = useMemo(() => todasInstituicoes.filter((i) => i.status === 'pendente'), [todasInstituicoes]);

  async function aprovarPendente(inst) {
    if (localizandoId === inst.id) return;
    setAvisoInst('');
    let extra = {};
    if (!instituicaoTemCoordenadas(inst)) {
      setLocalizandoId(inst.id);
      try {
        const geo = await geocodificarEndereco(inst);
        extra = camposDeLocalizacao(geo);
        setAvisoInst(`${inst.nome}: ${mensagemLocalizacao(geo)}`);
      } finally {
        setLocalizandoId(null);
      }
    }
    const novaLista = await atualizarStatusInstituicao(inst.id, 'aprovada', extra);
    setTodasInstituicoes(novaLista);
    await enviarEmailSimulado({
      destinatario: inst.emailContato || '(e-mail não encontrado)',
      assunto: 'Seu cadastro no Portal ConectaAção foi aprovado! 🎉',
      corpo: `Olá! O cadastro de "${inst.nome}" foi aprovado. Você já pode entrar no painel com o e-mail e a senha cadastrados e começar a cadastrar suas turmas — elas aparecerão automaticamente na busca dos pais.`,
    });
    setEmailsEnviados(await carregarEmailsEnviados());
  }

  function abrirRecusa(inst) { setRecusandoId(inst.id); setMotivoRecusa(''); }
  function cancelarRecusa() { setRecusandoId(null); setMotivoRecusa(''); }

  async function confirmarRecusa(inst) {
    const novaLista = await atualizarStatusInstituicao(inst.id, 'recusada', { motivoRecusa: motivoRecusa.trim() || null });
    setTodasInstituicoes(novaLista);
    await enviarEmailSimulado({
      destinatario: inst.emailContato || '(e-mail não encontrado)',
      assunto: 'Sobre o seu cadastro no Portal ConectaAção',
      corpo: `Olá! O cadastro de "${inst.nome}" não foi aprovado desta vez.${motivoRecusa.trim() ? ` Motivo: ${motivoRecusa.trim()}` : ''} Você pode entrar em contato com a equipe do portal pra entender melhor ou corrigir e enviar um novo cadastro.`,
    });
    setEmailsEnviados(await carregarEmailsEnviados());
    setRecusandoId(null);
    setMotivoRecusa('');
  }

  async function alternarEmails() {
    if (!mostrarEmails) setEmailsEnviados(await carregarEmailsEnviados());
    setMostrarEmails(!mostrarEmails);
  }

  // ------------------------------------------------- CRUD de instituição --
  // Usado tanto pelo admin (adicionar/editar/remover qualquer instituição)
  // quanto pela própria instituição (editar só os próprios dados).
  const [formInstAberto, setFormInstAberto] = useState(false);
  const [editandoInstId, setEditandoInstId] = useState(null); // null = criando nova
  const [formInst, setFormInst] = useState(FORM_INSTITUICAO_VAZIO);
  const [formInstEmail, setFormInstEmail] = useState('');
  const [formInstSenha, setFormInstSenha] = useState('');
  const [erroFormInst, setErroFormInst] = useState('');
  const [removendoInstId, setRemovendoInstId] = useState(null);
  const [salvandoInst, setSalvandoInst] = useState(false);

  function abrirNovaInstituicao() {
    setFormInst(FORM_INSTITUICAO_VAZIO);
    setFormInstEmail(''); setFormInstSenha('');
    setEditandoInstId(null); setErroFormInst(''); setFormInstAberto(true);
  }

  function abrirEdicaoInstituicao(inst) {
    setFormInst({ nome: inst.nome, tipo: inst.tipo, whatsapp: inst.whatsapp || '', endereco: inst.endereco || '', bairro: inst.bairro || '', cep: inst.cep || '' });
    setEditandoInstId(inst.id); setErroFormInst(''); setFormInstAberto(true);
  }

  function cancelarFormInst() { setFormInstAberto(false); setEditandoInstId(null); setErroFormInst(''); }

  async function salvarFormInstituicao() {
    if (salvandoInst) return;
    if (!formInst.nome.trim()) { setErroFormInst('Dá um nome pra instituição.'); return; }
    if (!formInst.whatsapp.trim()) { setErroFormInst('Informa um WhatsApp de contato.'); return; }

    setErroFormInst(''); setAvisoInst(''); setSalvandoInst(true);
    try {
      // Posição no mapa: busca as coordenadas do endereço quando a instituição
      // é nova, quando o endereço mudou, ou quando ela ainda não tem posição.
      const atual = editandoInstId ? todasInstituicoes.find((i) => i.id === editandoInstId) : null;
      const camposEndereco = ['endereco', 'bairro', 'cep'];
      const enderecoMudou = !atual || camposEndereco.some((k) => (atual[k] || '').trim() !== (formInst[k] || '').trim());
      let campos = { ...formInst };
      if (enderecoMudou || !instituicaoTemCoordenadas(atual)) {
        if (camposEndereco.some((k) => (formInst[k] || '').trim())) {
          const geo = await geocodificarEndereco(formInst);
          campos = { ...campos, ...camposDeLocalizacao(geo) };
          setAvisoInst(mensagemLocalizacao(geo));
        } else {
          campos = { ...campos, ...camposDeLocalizacao(null) };
        }
      }

      if (editandoInstId) {
        const novaLista = await editarInstituicao(editandoInstId, campos);
        setTodasInstituicoes(novaLista);
      } else {
        const { lista } = await adicionarInstituicao(campos, 'aprovada');
        setTodasInstituicoes(lista);
      }
      setFormInstAberto(false); setEditandoInstId(null);
    } finally {
      setSalvandoInst(false);
    }
  }

  // Botão "Localizar no mapa" (admin) pra instituições que ainda não têm posição.
  async function localizarNoMapa(inst) {
    if (localizandoId === inst.id) return;
    setAvisoInst(''); setLocalizandoId(inst.id);
    try {
      const geo = await geocodificarEndereco(inst);
      if (geo) {
        const novaLista = await editarInstituicao(inst.id, camposDeLocalizacao(geo));
        setTodasInstituicoes(novaLista);
      }
      setAvisoInst(`${inst.nome}: ${mensagemLocalizacao(geo)}`);
    } finally {
      setLocalizandoId(null);
    }
  }

  async function confirmarRemocaoInstituicao(inst) {
    const novaLista = await removerInstituicao(inst.id);
    setTodasInstituicoes(novaLista);
    setRemovendoInstId(null);
    if (institucaoAtualId === inst.id) setInstituicaoAtualId('todas');
  }

  // -------------------------------------------------- dados das turmas --
  const [institucaoAtualId, setInstituicaoAtualId] = useState('todas');
  const [turmasPorInstituicao, setTurmasPorInstituicao] = useState({});
  const [carregandoTurmas, setCarregandoTurmas] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState('');
  const [removendo, setRemovendo] = useState(null);
  const [erroStorage, setErroStorage] = useState(false);
  const [salvandoTurma, setSalvandoTurma] = useState(false);

  async function garantirCarregado(institucaoId) {
    if (turmasPorInstituicao[institucaoId]) return;
    const lista = await carregarTurmasDaInstituicao(institucaoId);
    setTurmasPorInstituicao((prev) => ({ ...prev, [institucaoId]: lista }));
  }

  useEffect(() => {
    if (!usuario) return;
    setCarregandoTurmas(true); setFormAberto(false);
    (async () => {
      if (usuario.papel === 'ong') await garantirCarregado(usuario.instituicaoId);
      else if (institucaoAtualId === 'todas') await Promise.all(instituicoesAprovadas.map((i) => garantirCarregado(i.id)));
      else await garantirCarregado(institucaoAtualId);
      setCarregandoTurmas(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, institucaoAtualId, instituicoesAprovadas.length]);

  const modoTodas = usuario?.papel === 'admin' && institucaoAtualId === 'todas';

  const turmasExibidas = useMemo(() => {
    if (!usuario) return [];
    if (usuario.papel === 'ong') return (turmasPorInstituicao[usuario.instituicaoId] || []).map((t) => ({ ...t, institucaoId: usuario.instituicaoId }));
    if (modoTodas) return instituicoesAprovadas.flatMap((inst) => (turmasPorInstituicao[inst.id] || []).map((t) => ({ ...t, institucaoId: inst.id })));
    return (turmasPorInstituicao[institucaoAtualId] || []).map((t) => ({ ...t, institucaoId: institucaoAtualId }));
  }, [usuario, turmasPorInstituicao, institucaoAtualId, modoTodas, instituicoesAprovadas]);

  async function persistirInstituicao(institucaoId, novaLista) {
    setTurmasPorInstituicao((prev) => ({ ...prev, [institucaoId]: novaLista }));
    try {
      await salvarTurmasDaInstituicao(institucaoId, novaLista);
      setErroStorage(false);
    } catch (e) {
      console.error(e);
      setErroStorage(explicarErroSalvar(e));
      // volta a tela para o que realmente está salvo, pra não ficar uma turma "fantasma"
      try {
        const salvas = await carregarTurmasDaInstituicao(institucaoId);
        setTurmasPorInstituicao((prev) => ({ ...prev, [institucaoId]: salvas }));
      } catch (e2) { /* sem conexão: mantém o que está na tela */ }
    }
  }

  function institucaoAlvoPadrao() { return usuario.papel === 'ong' ? usuario.instituicaoId : (modoTodas ? instituicoesAprovadas[0]?.id : institucaoAtualId); }

  function abrirNovaTurma() { setFormData({ ...FORM_VAZIO, institucaoId: institucaoAlvoPadrao() }); setEditando(null); setErroForm(''); setFormAberto(true); }
  function abrirEdicao(t) { setFormData({ nome: t.nome, categoria: t.categoria, idadeMin: t.idadeMin, idadeMax: t.idadeMax, status: t.status, atestado: t.atestado, historico: t.historico, tipoAtividade: t.tipoAtividade || 'continua', dataEvento: t.dataEvento || '', horaInicio: t.horaInicio || '', horaFim: t.horaFim || '', endereco: t.endereco || '', bairro: t.bairro || '', institucaoId: t.institucaoId }); setEditando({ institucaoId: t.institucaoId, id: t.id }); setErroForm(''); setFormAberto(true); }
  function cancelarForm() { setFormAberto(false); setEditando(null); setErroForm(''); }

  async function salvarForm() {
    if (salvandoTurma) return;
    if (!formData.nome.trim()) { setErroForm('Dá um nome pra turma.'); return; }
    const idadeMinN = Number(formData.idadeMin), idadeMaxN = Number(formData.idadeMax);
    if (!Number.isFinite(idadeMinN) || !Number.isFinite(idadeMaxN) || idadeMinN < 0 || idadeMaxN > 99) { setErroForm('As idades precisam estar entre 0 e 99 anos.'); return; }
    if (Number(formData.idadeMin) > Number(formData.idadeMax)) { setErroForm('A idade mínima não pode ser maior que a máxima.'); return; }
    const pontual = formData.tipoAtividade === 'pontual';
    if (pontual && !formData.dataEvento) { setErroForm('Escolhe a data do evento.'); return; }
    if (pontual && formData.horaInicio && formData.horaFim && formData.horaFim <= formData.horaInicio) { setErroForm('O horário de término precisa ser depois do início.'); return; }

    setErroForm(''); setAvisoInst(''); setSalvandoTurma(true);
    try {
      const alvoId = usuario.papel === 'ong' ? usuario.instituicaoId : formData.institucaoId;
      const listaAtual = turmasPorInstituicao[alvoId] || [];
      const { institucaoId, ...campos } = formData;
      const camposLimpos = {
        ...campos, idadeMin: Number(formData.idadeMin), idadeMax: Number(formData.idadeMax),
        dataEvento: pontual ? campos.dataEvento : '', horaInicio: pontual ? campos.horaInicio : '', horaFim: pontual ? campos.horaFim : '',
        endereco: (campos.endereco || '').trim(), bairro: (campos.bairro || '').trim(),
      };

      // Endereço da atividade: se foi preenchido, localiza no mapa; em branco = usa o endereço da instituição.
      const anterior = editando ? (turmasPorInstituicao[editando.institucaoId] || []).find((t) => t.id === editando.id) : null;
      const temEndereco = !!(camposLimpos.endereco || camposLimpos.bairro);
      const enderecoMudou = !anterior || (anterior.endereco || '') !== camposLimpos.endereco || (anterior.bairro || '') !== camposLimpos.bairro;
      if (!temEndereco) {
        Object.assign(camposLimpos, camposDeLocalizacao(null));
      } else if (enderecoMudou || typeof anterior?.latitude !== 'number') {
        const geo = await geocodificarEndereco(camposLimpos);
        Object.assign(camposLimpos, camposDeLocalizacao(geo));
        setAvisoInst(`Endereço da atividade: ${mensagemLocalizacao(geo)}`);
      } else {
        camposLimpos.latitude = anterior.latitude;
        camposLimpos.longitude = anterior.longitude;
        camposLimpos.precisaoLocalizacao = anterior.precisaoLocalizacao;
      }

      if (editando && editando.institucaoId === alvoId) {
        await persistirInstituicao(alvoId, listaAtual.map((t) => (t.id === editando.id ? { ...t, ...camposLimpos } : t)));
      } else if (editando) {
        await persistirInstituicao(editando.institucaoId, (turmasPorInstituicao[editando.institucaoId] || []).filter((t) => t.id !== editando.id));
        await persistirInstituicao(alvoId, [...listaAtual, { id: editando.id, ...camposLimpos }]);
      } else {
        await persistirInstituicao(alvoId, [...listaAtual, { id: `t-${Date.now()}`, ...camposLimpos }]);
      }
      setFormAberto(false); setEditando(null);
    } finally {
      setSalvandoTurma(false);
    }
  }

  function confirmarRemocao(t) { persistirInstituicao(t.institucaoId, (turmasPorInstituicao[t.institucaoId] || []).filter((x) => x.id !== t.id)); setRemovendo(null); }
  function mudarStatus(t, novoStatus) { persistirInstituicao(t.institucaoId, (turmasPorInstituicao[t.institucaoId] || []).map((x) => (x.id === t.id ? { ...x, status: novoStatus } : x))); }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
    .pn-app { --paper:#EEF2EA; --ink:#1B3A2B; --coral:#E85A3B; --marigold:#E8A23B; --muted:#6B7A6E; --card:#FFFFFF;
      font-family:'IBM Plex Sans',system-ui,sans-serif; background:var(--paper); color:var(--ink); max-width:430px; margin:0 auto; min-height:100vh; padding-bottom:32px; }
    .pn-app * { box-sizing:border-box; }
    .pn-header { background:var(--ink); color:var(--paper); padding:16px 20px 26px; }
    .pn-voltar { display:inline-flex; align-items:center; gap:5px; border:none; background:transparent; color:rgba(238,242,234,0.75); font-family:inherit; font-size:12.5px; cursor:pointer; padding:0 0 10px; }
    .pn-wordmark { display:flex; align-items:center; gap:8px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:22px; }
    .pn-wordmark svg { color:var(--marigold); flex-shrink:0; }
    .pn-subtitulo { margin:4px 0 0 28px; font-size:13px; color:rgba(238,242,234,0.75); }
    .pn-login-wrap { padding:20px 20px 0; }
    .pn-auth-tabs { display:flex; gap:6px; background:rgba(27,58,43,0.07); border-radius:10px; padding:4px; margin-bottom:14px; }
    .pn-auth-tabs button { flex:1; border:none; background:transparent; color:var(--muted); font-family:inherit; font-size:13px; font-weight:500; padding:8px 0; border-radius:7px; cursor:pointer; }
    .pn-auth-tabs button.ativo { background:var(--card); color:var(--ink); box-shadow:0 1px 3px rgba(27,58,43,0.12); }
    .pn-login-card { background:var(--card); border:1px solid rgba(27,58,43,0.12); border-radius:14px; padding:20px; }
    .pn-login-card h2 { margin:0 0 4px; font-size:17px; }
    .pn-login-card p.desc { margin:0 0 18px; font-size:12.5px; color:var(--muted); }
    .pn-campo { margin-bottom:12px; }
    .pn-campo label { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }
    .pn-campo input, .pn-campo select { width:100%; font-family:inherit; font-size:14px; color:var(--ink); border:1px solid rgba(27,58,43,0.18); border-radius:8px; padding:10px 11px; background:#fff; }
    .pn-campo-dupla { display:flex; gap:10px; }
    .pn-campo-dupla .pn-campo { flex:1; }
    .pn-senha-wrap { position:relative; }
    .pn-senha-wrap button { position:absolute; right:8px; top:8px; border:none; background:transparent; color:var(--muted); cursor:pointer; padding:4px; display:flex; }
    .pn-erro-form { font-size:12.5px; color:var(--coral); margin-bottom:10px; }
    .pn-btn-entrar { width:100%; border:none; background:var(--ink); color:var(--paper); font-family:inherit; font-size:14px; font-weight:600; padding:11px 0; border-radius:9px; cursor:pointer; }
    .pn-conta-bar { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 0; }
    .pn-conta-info { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--muted); }
    .pn-badge-admin { display:flex; align-items:center; gap:5px; background:var(--marigold); color:#fff; font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px; }
    .pn-btn-sair { display:flex; align-items:center; gap:5px; border:none; background:transparent; color:var(--muted); font-family:inherit; font-size:12.5px; cursor:pointer; }
    .pn-seletor { margin:14px 16px 0; }
    .pn-seletor label { display:block; font-size:12.5px; color:var(--muted); margin-bottom:6px; }
    .pn-seletor select { width:100%; font-family:inherit; font-size:14.5px; color:var(--ink); background:var(--card); border:1px solid rgba(27,58,43,0.16); border-radius:10px; padding:10px 12px; }
    .pn-toolbar { display:flex; align-items:center; justify-content:space-between; margin:18px 16px 0; }
    .pn-toolbar h2 { font-size:14px; margin:0; color:var(--muted); font-weight:500; }
    .pn-btn-nova { display:flex; align-items:center; gap:6px; border:none; background:var(--coral); color:#fff; font-family:inherit; font-size:13px; font-weight:600; padding:8px 12px; border-radius:8px; cursor:pointer; }
    .pn-lista { margin:12px 16px 0; display:flex; flex-direction:column; gap:10px; }
    .pn-linha { background:var(--card); border:1px solid rgba(27,58,43,0.10); border-radius:10px; padding:12px 14px; }
    .pn-linha-inst { display:flex; align-items:center; gap:5px; font-size:11.5px; color:var(--muted); margin-bottom:6px; }
    .pn-linha-top { display:flex; align-items:center; gap:8px; }
    .pn-linha-top svg.icone-cat { color:var(--muted); flex-shrink:0; }
    .pn-linha h3 { margin:0; font-size:15px; font-weight:600; flex:1; }
    .pn-linha-tags { display:flex; gap:6px; margin:8px 0 10px; flex-wrap:wrap; }
    .pn-tag { font-size:12px; background:rgba(27,58,43,0.06); color:var(--ink); padding:4px 9px; border-radius:7px; }
    .pn-tag-status { background:rgba(232,90,58,0.14); color:var(--coral); font-weight:600; }
    .pn-status-row { display:flex; gap:6px; margin-bottom:10px; }
    .pn-status-pill { flex:1; border:1px solid rgba(27,58,43,0.16); background:var(--card); color:var(--ink); font-family:inherit; font-size:11.5px; padding:6px 4px; border-radius:999px; cursor:pointer; }
    .pn-status-pill.ativo { color:#fff; border-color:transparent; }
    .pn-linha-acoes { display:flex; gap:8px; }
    .pn-mini-btn { display:flex; align-items:center; gap:5px; border:none; background:transparent; color:var(--ink); font-family:inherit; font-size:12.5px; padding:6px 4px; cursor:pointer; }
    .pn-mini-btn.remover { color:var(--coral); margin-left:auto; }
    .pn-confirma { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--coral); margin-left:auto; }
    .pn-confirma button { border:none; background:var(--coral); color:#fff; font-family:inherit; font-size:12px; padding:5px 10px; border-radius:6px; cursor:pointer; }
    .pn-confirma button.cancelar { background:transparent; color:var(--muted); }
    .pn-vazio { margin:14px 16px 0; text-align:center; color:var(--muted); font-size:13px; padding:30px 20px; background:var(--card); border:1px dashed rgba(27,58,43,0.2); border-radius:10px; }
    .pn-form { margin:12px 16px 0; background:var(--card); border:1px solid rgba(27,58,43,0.14); border-radius:12px; padding:14px; }
    .pn-form-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .pn-form-top h3 { margin:0; font-size:14.5px; }
    .pn-checks { display:flex; flex-direction:column; gap:6px; margin:4px 0 12px; }
    .pn-checks label { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink); }
    .pn-checks input { width:17px; height:17px; accent-color:var(--ink); }
    .pn-form-acoes { display:flex; gap:10px; }
    .pn-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; border:none; border-radius:9px; padding:10px 0; font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer; }
    .pn-btn.primario { background:var(--ink); color:var(--paper); }
    .pn-btn.secundario { background:transparent; color:var(--muted); border:1px solid rgba(27,58,43,0.18); }
    .pn-carregando { margin:14px 16px 0; font-size:13px; color:var(--muted); }
    .pn-aviso-storage { margin:12px 16px 0; font-size:12px; color:var(--coral); }
    .pn-rodape { text-align:center; font-size:11px; color:var(--muted); padding:22px 24px 0; line-height:1.5; }

    /* ---- upload de documento + nota de análise (cadastro) ---- */
    .pn-upload { display:flex; align-items:center; gap:8px; border:1px dashed rgba(27,58,43,0.3); border-radius:8px; padding:10px 11px; font-size:13px; color:var(--muted); cursor:pointer; background:#fff; }
    .pn-upload:hover { border-color:rgba(27,58,43,0.5); }
    .pn-nota-analise { font-size:11.5px; color:var(--muted); background:rgba(27,58,43,0.05); border-radius:8px; padding:9px 11px; margin:2px 0 12px; line-height:1.5; }

    /* ---- tela de confirmação após cadastro ---- */
    .pn-confirmacao { text-align:center; }
    .pn-confirmacao-icone { width:44px; height:44px; border-radius:50%; background:rgba(232,162,59,0.18); color:var(--marigold); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; }
    .pn-confirmacao h2 { margin:0 0 6px; }

    /* ---- abas do admin (Turmas / Cadastros pendentes) ---- */
    .pn-abas-admin { display:flex; gap:6px; margin:14px 16px 0; background:rgba(27,58,43,0.07); border-radius:10px; padding:4px; }
    .pn-abas-admin button { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; border:none; background:transparent; color:var(--muted); font-family:inherit; font-size:13px; font-weight:500; padding:8px 0; border-radius:7px; cursor:pointer; }
    .pn-abas-admin button.ativo { background:var(--card); color:var(--ink); box-shadow:0 1px 3px rgba(27,58,43,0.12); }
    .pn-contador { background:var(--coral); color:#fff; font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:999px; }

    /* ---- fila de cadastros pendentes ---- */
    .pn-pendentes-wrap { padding-bottom:8px; }
    .pn-pendente-info { font-size:12px; color:var(--muted); margin:2px 0; }
    .pn-doc-link { display:inline-flex; align-items:center; gap:5px; font-size:12.5px; color:var(--ink); text-decoration:underline; margin:6px 0; }
    .pn-mini-btn.aprovar { color:#2E7D32; }
    .pn-recusa-form { margin-top:8px; }
    .pn-recusa-form input { width:100%; font-family:inherit; font-size:13px; border:1px solid rgba(27,58,43,0.18); border-radius:8px; padding:8px 10px; margin-bottom:8px; }

    /* ---- log de e-mails simulados ---- */
    .pn-btn-emails { display:flex; align-items:center; gap:7px; margin:14px 16px 0; border:1px solid rgba(27,58,43,0.16); background:var(--card); color:var(--ink); font-family:inherit; font-size:12.5px; padding:9px 14px; border-radius:8px; cursor:pointer; }
    .pn-emails-lista { margin:10px 16px 0; display:flex; flex-direction:column; gap:8px; }
    .pn-emails-vazio { display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--muted); }
    .pn-email { background:var(--card); border:1px solid rgba(27,58,43,0.10); border-radius:9px; padding:10px 12px; }
    .pn-email-topo { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--muted); margin-bottom:4px; gap:8px; }
    .pn-email-topo span { display:flex; align-items:center; gap:4px; }
    .pn-email-data { flex-shrink:0; white-space:nowrap; }
    .pn-email-assunto { font-size:13px; font-weight:600; color:var(--ink); margin:0 0 3px; }
    .pn-email-corpo { font-size:12px; color:var(--muted); margin:0; line-height:1.5; }

    /* ---- aviso de localização, selos e botões desativados ---- */
    .pn-aviso-info { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin:12px 16px 0; font-size:12.5px; line-height:1.5; color:var(--ink); background:rgba(232,162,59,0.16); border-radius:8px; padding:9px 12px; }
    .pn-aviso-info button { border:none; background:transparent; color:var(--muted); cursor:pointer; padding:2px; display:flex; flex-shrink:0; }
    .pn-tag-aviso { background:rgba(232,162,59,0.18); color:#8a5a00; font-weight:600; }
    .pn-mini-btn:disabled, .pn-btn:disabled { opacity:0.55; cursor:default; }
    button.pn-doc-link { border:none; background:transparent; cursor:pointer; font-family:inherit; padding:0; }
    .pn-campo .pn-radios { display:flex; gap:8px; flex-wrap:wrap; }
    .pn-campo .pn-radio { position:relative; flex:1; min-width:140px; display:flex; flex-direction:column; align-items:flex-start; gap:3px; border:1px solid rgba(27,58,43,0.18); border-radius:9px; padding:10px 12px; margin:0; font-size:14px; font-weight:600; line-height:1.3; color:var(--ink); cursor:pointer; background:#fff; }
    .pn-campo .pn-radio.ativo { border-color:var(--ink); background:rgba(27,58,43,0.06); }
    .pn-campo .pn-radio input { position:absolute; opacity:0; pointer-events:none; width:0; height:0; padding:0; border:0; }
    .pn-campo .pn-radio small { display:block; color:var(--muted); font-size:12px; font-weight:400; }
    .pn-tag-evento { background:rgba(37,99,235,0.12); color:#1d4ed8; font-weight:600; display:inline-flex; align-items:center; gap:4px; }

    /* ---- Desktop: painel usa a largura da tela, login fica num cartão centralizado ---- */
    @media (min-width: 860px) {
      .pn-app { max-width:1040px; }
      .pn-header { padding:20px 32px 30px; }
      .pn-login-wrap { max-width:480px; margin:0 auto; padding:40px 20px 0; }
      .pn-conta-bar { padding:16px 32px 0; }
      .pn-seletor { margin:16px 32px 0; max-width:380px; }
      .pn-toolbar { margin:20px 32px 0; }
      .pn-form { margin:14px 32px 0; max-width:680px; }
      .pn-lista { margin:14px 32px 0; display:grid; grid-template-columns:repeat(2, 1fr); align-items:start; gap:14px; }
      .pn-vazio { margin:16px 32px 0; }
      .pn-aviso-storage { margin:12px 32px 0; }
      .pn-aviso-info { margin:12px 32px 0; }
      .pn-rodape { padding:26px 32px 0; text-align:left; }
      .pn-abas-admin { margin:16px 32px 0; max-width:420px; }
      .pn-pendentes-wrap .pn-lista { margin:14px 32px 0; }
      .pn-btn-emails, .pn-emails-lista { margin-left:32px; margin-right:32px; }
      .pn-emails-lista { max-width:680px; }
    }
    @media (min-width: 1300px) {
      .pn-lista { grid-template-columns:repeat(3, 1fr); }
    }
  `;

  if (carregandoSessao) return <div className="pn-app"><style>{css}</style><p className="pn-carregando">Carregando…</p></div>;

  if (!usuario) {
    return (
      <div className="pn-app">
        <style>{css}</style>
        <header className="pn-header">
          <button className="pn-voltar" onClick={voltar}><ArrowLeft size={13} /> Início</button>
          <div className="pn-wordmark"><MapPin size={20} strokeWidth={2.2} />ConectaAção</div>
          <p className="pn-subtitulo">Acesso da instituição</p>
        </header>
        <div className="pn-login-wrap">
          {cadastroEnviado ? (
            <div className="pn-login-card pn-confirmacao">
              <div className="pn-confirmacao-icone"><Clock size={22} /></div>
              <h2>Cadastro enviado!</h2>
              <p className="desc">Sua instituição está em análise. Você recebe um e-mail assim que ela for aprovada ou recusada por um administrador.</p>
              <button className="pn-btn-entrar" onClick={() => { setCadastroEnviado(false); setModoAuth('entrar'); }}>Voltar pro login</button>
            </div>
          ) : (
          <>
          <div className="pn-auth-tabs">
            <button className={modoAuth === 'entrar' ? 'ativo' : ''} onClick={() => { setModoAuth('entrar'); setErroAuth(''); }}>Entrar</button>
            <button className={modoAuth === 'cadastrar' ? 'ativo' : ''} onClick={() => { setModoAuth('cadastrar'); setErroAuth(''); }}>Cadastrar minha ONG</button>
          </div>

          {modoAuth === 'entrar' ? (
            <div className="pn-login-card">
              <h2>Entrar no painel</h2>
              <p className="desc">Use o e-mail e a senha da sua instituição, ou a conta de administrador.</p>
              <div className="pn-campo"><label>E-mail</label><input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu-email@exemplo.org" onKeyDown={(e) => e.key === 'Enter' && entrar()} /></div>
              <div className="pn-campo">
                <label>Senha</label>
                <div className="pn-senha-wrap">
                  <input type={verSenha ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && entrar()} />
                  <button onClick={() => setVerSenha(!verSenha)} type="button" aria-label="Mostrar senha">{verSenha ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              {erroAuth && <p className="pn-erro-form">{erroAuth}</p>}
              <button className="pn-btn-entrar" onClick={entrar}>Entrar</button>
            </div>
          ) : (
            <div className="pn-login-card">
              <h2>Cadastrar instituição</h2>
              <p className="desc">Crie o acesso da sua ONG, CEU, clube ou associação pra gerenciar turmas.</p>
              <div className="pn-campo"><label>Nome da instituição</label><input type="text" value={reg.nome} onChange={(e) => setReg({ ...reg, nome: e.target.value })} placeholder="Ex: Centro Comunitário..." /></div>
              <div className="pn-campo"><label>Tipo</label><select value={reg.tipo} onChange={(e) => setReg({ ...reg, tipo: e.target.value })}>{TIPOS_INSTITUICAO.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="pn-campo"><label>E-mail de acesso</label><input type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} placeholder="contato@suaong.org" /></div>
              <div className="pn-campo-dupla">
                <div className="pn-campo"><label>Senha</label><input type="password" value={reg.senha} onChange={(e) => setReg({ ...reg, senha: e.target.value })} placeholder="mín. 6 caracteres" /></div>
                <div className="pn-campo"><label>Confirmar senha</label><input type="password" value={reg.confirmar} onChange={(e) => setReg({ ...reg, confirmar: e.target.value })} /></div>
              </div>
              <div className="pn-campo"><label>WhatsApp de contato</label><input type="text" value={reg.whatsapp} onChange={(e) => setReg({ ...reg, whatsapp: e.target.value })} placeholder="Ex: 5511999990000" /></div>
              <div className="pn-campo"><label>Endereço</label><input type="text" value={reg.endereco} onChange={(e) => setReg({ ...reg, endereco: e.target.value })} placeholder="Rua, número" /></div>
              <div className="pn-campo-dupla">
                <div className="pn-campo"><label>Bairro</label><input type="text" value={reg.bairro} onChange={(e) => setReg({ ...reg, bairro: e.target.value })} /></div>
                <div className="pn-campo"><label>CEP</label><input type="text" value={reg.cep} onChange={(e) => setReg({ ...reg, cep: e.target.value })} placeholder="opcional" /></div>
              </div>
              <div className="pn-campo">
                <label>Documento que comprove a instituição</label>
                <label className="pn-upload">
                  <Upload size={15} />
                  {arquivoDoc ? arquivoDoc.nome : 'Anexar estatuto, CNPJ ou similar (PDF ou imagem, até 2 MB)'}
                  <input type="file" accept=".pdf,image/*" onChange={selecionarArquivo} style={{ display: 'none' }} />
                </label>
                {erroArquivo && <p className="pn-erro-form">{erroArquivo}</p>}
              </div>
              <p className="pn-nota-analise">Sua instituição passa por uma análise antes de poder cadastrar turmas — você recebe um e-mail com o resultado.</p>
              {erroAuth && <p className="pn-erro-form">{erroAuth}</p>}
              <button className="pn-btn-entrar" onClick={cadastrarOng}>Criar conta</button>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pn-app">
      <style>{css}</style>
      <header className="pn-header">
        <div className="pn-wordmark"><MapPin size={20} strokeWidth={2.2} />ConectaAção</div>
        <p className="pn-subtitulo">{usuario.papel === 'admin' ? 'Painel de gestão — administrador' : `Painel de gestão — ${nomeInstituicao(usuario.instituicaoId)}`}</p>
      </header>

      <div className="pn-conta-bar">
        <div className="pn-conta-info">{usuario.papel === 'admin' ? <span className="pn-badge-admin"><ShieldCheck size={12} /> Acesso total</span> : <><Building2 size={13} /> {nomeInstituicao(usuario.instituicaoId)}</>}</div>
        <button className="pn-btn-sair" onClick={sair}><LogOut size={13} /> Sair</button>
      </div>

      {usuario.papel === 'admin' && (
        <div className="pn-abas-admin">
          <button className={abaAdmin === 'turmas' ? 'ativo' : ''} onClick={() => setAbaAdmin('turmas')}>Turmas</button>
          <button className={abaAdmin === 'instituicoes' ? 'ativo' : ''} onClick={() => setAbaAdmin('instituicoes')}>Instituições</button>
          <button className={abaAdmin === 'pendentes' ? 'ativo' : ''} onClick={() => setAbaAdmin('pendentes')}>
            Pendentes{pendentes.length > 0 && <span className="pn-contador">{pendentes.length}</span>}
          </button>
        </div>
      )}

      {avisoInst && (
        <p className="pn-aviso-info"><span>{avisoInst}</span><button onClick={() => setAvisoInst('')} aria-label="Fechar aviso"><X size={12} /></button></p>
      )}

      {usuario.papel === 'admin' && abaAdmin === 'pendentes' ? (
        <div className="pn-pendentes-wrap">
          {pendentes.length === 0 ? (
            <div className="pn-vazio">Nenhum cadastro esperando aprovação no momento.</div>
          ) : (
            <div className="pn-lista">
              {pendentes.map((inst) => (
                <div className="pn-linha" key={inst.id}>
                  <div className="pn-linha-top"><Building2 size={16} className="icone-cat" /><h3>{inst.nome}</h3></div>
                  <div className="pn-linha-tags">
                    <span className="pn-tag">{inst.tipo}</span>
                    {inst.bairro && <span className="pn-tag">{inst.bairro}</span>}
                  </div>
                  <p className="pn-pendente-info">WhatsApp: {inst.whatsapp} {inst.endereco && `· ${inst.endereco}`}</p>
                  <p className="pn-pendente-info">Cadastrado em {new Date(inst.dataCadastro).toLocaleDateString('pt-BR')}</p>
                  {inst.documento && (
                    <button className="pn-doc-link" onClick={() => baixarDocumento(inst)}>
                      <FileText size={13} /> {inst.documento.nome}
                    </button>
                  )}
                  {recusandoId === inst.id ? (
                    <div className="pn-recusa-form">
                      <input type="text" placeholder="Motivo da recusa (opcional)" value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} />
                      <div className="pn-linha-acoes">
                        <button className="pn-mini-btn remover" onClick={() => confirmarRecusa(inst)}><X size={13} /> Confirmar recusa</button>
                        <button className="pn-mini-btn" onClick={cancelarRecusa}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="pn-linha-acoes">
                      <button className="pn-mini-btn aprovar" onClick={() => aprovarPendente(inst)} disabled={localizandoId === inst.id}><Check size={13} /> {localizandoId === inst.id ? 'Localizando endereço…' : 'Aprovar'}</button>
                      <button className="pn-mini-btn remover" onClick={() => abrirRecusa(inst)}><X size={13} /> Recusar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button className="pn-btn-emails" onClick={alternarEmails}>
            <Mail size={14} /> {mostrarEmails ? 'Esconder' : 'Ver'} e-mails simulados {emailsEnviados.length > 0 && !mostrarEmails ? `(${emailsEnviados.length})` : ''}
          </button>
          {mostrarEmails && (
            <div className="pn-emails-lista">
              {emailsEnviados.length === 0 ? (
                <p className="pn-emails-vazio"><Inbox size={14} /> Nenhum e-mail simulado ainda.</p>
              ) : emailsEnviados.map((em) => (
                <div className="pn-email" key={em.id}>
                  <div className="pn-email-topo">
                    <span><Mail size={12} /> {em.destinatario}</span>
                    <span className="pn-email-data"><Clock size={11} /> {new Date(em.enviadoEm).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="pn-email-assunto">{em.assunto}</p>
                  <p className="pn-email-corpo">{em.corpo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : usuario.papel === 'admin' && abaAdmin === 'instituicoes' ? (
        <div className="pn-pendentes-wrap">
          <div className="pn-toolbar">
            <h2>{todasInstituicoes.length} {todasInstituicoes.length === 1 ? 'instituição' : 'instituições'}</h2>
            {!formInstAberto && <button className="pn-btn-nova" onClick={abrirNovaInstituicao}><Plus size={15} /> Nova instituição</button>}
          </div>

          {formInstAberto && (
            <FormularioInstituicao
              formInst={formInst} setFormInst={setFormInst}
              editando={!!editandoInstId}
              formInstEmail={formInstEmail} setFormInstEmail={setFormInstEmail}
              formInstSenha={formInstSenha} setFormInstSenha={setFormInstSenha}
              erro={erroFormInst}
              onSalvar={salvarFormInstituicao}
              onCancelar={cancelarFormInst}
              salvando={salvandoInst}
            />
          )}

          <div className="pn-lista">
            {todasInstituicoes.map((inst) => (
              <div className="pn-linha" key={inst.id}>
                <div className="pn-linha-top"><Building2 size={16} className="icone-cat" /><h3>{inst.nome}</h3></div>
                <div className="pn-linha-tags">
                  <span className="pn-tag">{inst.tipo}</span>
                  {inst.bairro && <span className="pn-tag">{inst.bairro}</span>}
                  {inst.status && inst.status !== 'aprovada' && <span className="pn-tag pn-tag-status">{inst.status === 'pendente' ? 'Pendente' : 'Recusada'}</span>}
                  {!instituicaoTemCoordenadas(inst) && <span className="pn-tag pn-tag-aviso">Sem posição no mapa</span>}
                  {(inst.precisaoLocalizacao === 'bairro' || inst.precisaoLocalizacao === 'cep') && <span className="pn-tag pn-tag-aviso">Posição aproximada</span>}
                </div>
                <p className="pn-pendente-info">WhatsApp: {inst.whatsapp || '—'} {inst.endereco && `· ${inst.endereco}`}</p>
                {removendoInstId === inst.id ? (
                  <div className="pn-confirma">Remover essa instituição (e as turmas dela)?
                    <button onClick={() => confirmarRemocaoInstituicao(inst)}>Sim</button>
                    <button className="cancelar" onClick={() => setRemovendoInstId(null)}>Não</button>
                  </div>
                ) : (
                  <div className="pn-linha-acoes">
                    <button className="pn-mini-btn" onClick={() => abrirEdicaoInstituicao(inst)}><Pencil size={13} /> Editar</button>
                    {!instituicaoTemCoordenadas(inst) && (
                      <button className="pn-mini-btn" onClick={() => localizarNoMapa(inst)} disabled={localizandoId === inst.id}><MapPin size={13} /> {localizandoId === inst.id ? 'Localizando…' : 'Localizar no mapa'}</button>
                    )}
                    <button className="pn-mini-btn remover" onClick={() => setRemovendoInstId(inst.id)}><Trash2 size={13} /> Remover</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>

      {usuario.papel === 'admin' && (
        <div className="pn-seletor">
          <label>Ver turmas de</label>
          <select value={institucaoAtualId} onChange={(e) => setInstituicaoAtualId(e.target.value)}>
            <option value="todas">Todas as instituições</option>
            {instituicoesAprovadas.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>
      )}

      {usuario.papel === 'ong' && (
        <div className="pn-seletor">
          {formInstAberto ? (
            <FormularioInstituicao
              formInst={formInst} setFormInst={setFormInst}
              editando
              erro={erroFormInst}
              onSalvar={salvarFormInstituicao}
              onCancelar={cancelarFormInst}
              salvando={salvandoInst}
            />
          ) : (
            <button className="pn-mini-btn" onClick={() => abrirEdicaoInstituicao(todasInstituicoes.find((i) => i.id === usuario.instituicaoId))}>
              <Pencil size={13} /> Editar dados da instituição
            </button>
          )}
        </div>
      )}

      <div className="pn-toolbar">
        <h2>{turmasExibidas.length} {turmasExibidas.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}</h2>
        {!formAberto && <button className="pn-btn-nova" onClick={abrirNovaTurma}><Plus size={15} /> Nova turma</button>}
      </div>

      {formAberto && (
        <div className="pn-form">
          <div className="pn-form-top"><h3>{editando ? 'Editar turma' : 'Nova turma'}</h3><button onClick={cancelarForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><X size={16} /></button></div>
          {usuario.papel === 'admin' && (
            <div className="pn-campo"><label>Instituição</label><select value={formData.institucaoId} onChange={(e) => setFormData({ ...formData, institucaoId: e.target.value })}>{instituicoesAprovadas.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></div>
          )}
          <div className="pn-campo"><label>Nome da atividade</label><input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Judô, Balé Infantil..." /></div>
          <div className="pn-campo">
            <label>Tipo de atividade</label>
            <div className="pn-radios">
              <label className={`pn-radio ${formData.tipoAtividade !== 'pontual' ? 'ativo' : ''}`}><input type="radio" name="tipoAtividade" checked={formData.tipoAtividade !== 'pontual'} onChange={() => setFormData({ ...formData, tipoAtividade: 'continua' })} />Contínua<small>turma regular, com vagas</small></label>
              <label className={`pn-radio ${formData.tipoAtividade === 'pontual' ? 'ativo' : ''}`}><input type="radio" name="tipoAtividade" checked={formData.tipoAtividade === 'pontual'} onChange={() => setFormData({ ...formData, tipoAtividade: 'pontual' })} />Evento de um dia<small>data específica</small></label>
            </div>
          </div>
          {formData.tipoAtividade === 'pontual' && (
            <>
              <div className="pn-campo"><label>Data do evento</label><input type="date" value={formData.dataEvento} onChange={(e) => setFormData({ ...formData, dataEvento: e.target.value })} /></div>
              <div className="pn-campo-dupla">
                <div className="pn-campo"><label>Início (opcional)</label><input type="time" value={formData.horaInicio} onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })} /></div>
                <div className="pn-campo"><label>Término (opcional)</label><input type="time" value={formData.horaFim} onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })} /></div>
              </div>
            </>
          )}
          <div className="pn-campo"><label>Categoria</label><select value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}>{CATEGORIAS_FORM.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="pn-campo-dupla">
            <div className="pn-campo"><label>Idade mínima</label><input type="number" min="0" max="99" value={formData.idadeMin} onChange={(e) => setFormData({ ...formData, idadeMin: e.target.value })} /></div>
            <div className="pn-campo"><label>Idade máxima</label><input type="number" min="0" max="99" value={formData.idadeMax} onChange={(e) => setFormData({ ...formData, idadeMax: e.target.value })} /></div>
          </div>
          <div className="pn-campo"><label>Status das vagas</label><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>{STATUS_OPCOES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="pn-campo-dupla">
            <div className="pn-campo"><label>Onde acontece (opcional)</label><input type="text" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua e número" /></div>
            <div className="pn-campo"><label>Bairro (opcional)</label><input type="text" value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} /></div>
          </div>
          <p className="pn-nota-analise">Se preencher, o endereço da atividade é localizado no mapa. Em branco, a atividade usa o endereço da instituição.</p>
          {formData.tipoAtividade !== 'pontual' && (
          <div className="pn-checks">
            <label><input type="checkbox" checked={formData.atestado} onChange={(e) => setFormData({ ...formData, atestado: e.target.checked })} /> Exige atestado médico</label>
            <label><input type="checkbox" checked={formData.historico} onChange={(e) => setFormData({ ...formData, historico: e.target.checked })} /> Exige histórico escolar</label>
          </div>
          )}
          {erroForm && <p className="pn-erro-form">{erroForm}</p>}
          <div className="pn-form-acoes"><button className="pn-btn primario" onClick={salvarForm} disabled={salvandoTurma}>{salvandoTurma ? 'Salvando…' : 'Salvar turma'}</button><button className="pn-btn secundario" onClick={cancelarForm}>Cancelar</button></div>
        </div>
      )}

      {erroStorage && <p className="pn-aviso-storage">Não deu pra salvar: {typeof erroStorage === 'string' ? erroStorage : 'erro desconhecido'}.</p>}

      {carregandoTurmas ? (
        <p className="pn-carregando">Carregando turmas…</p>
      ) : turmasExibidas.length === 0 && !formAberto ? (
        <div className="pn-vazio">Nenhuma turma cadastrada ainda.<br />Toque em "Nova turma" pra começar.</div>
      ) : (
        <div className="pn-lista">
          {turmasExibidas.map((t) => {
            const Icone = ICONE_CATEGORIA[t.categoria];
            const removendoEsta = removendo && removendo.id === t.id && removendo.institucaoId === t.institucaoId;
            return (
              <div className="pn-linha" key={`${t.institucaoId}-${t.id}`}>
                {modoTodas && <div className="pn-linha-inst"><Building2 size={12} /> {nomeInstituicao(t.institucaoId)}</div>}
                <div className="pn-linha-top"><Icone size={16} className="icone-cat" /><h3>{t.nome}</h3></div>
                <div className="pn-linha-tags">
                  <span className="pn-tag">{t.categoria}</span><span className="pn-tag">{t.idadeMin} a {t.idadeMax} anos</span>
                  {t.tipoAtividade === 'pontual' && <span className="pn-tag pn-tag-evento"><CalendarDays size={11} /> Evento de um dia{t.dataEvento ? ` · ${formatarQuando(t)}` : ''}</span>}
                  {eventoJaPassou(t) && <span className="pn-tag pn-tag-aviso">Já aconteceu — não aparece na busca</span>}
                  {t.atestado && <span className="pn-tag">Atestado médico</span>}
                  {t.historico && <span className="pn-tag">Histórico escolar</span>}
                </div>
                {(t.endereco || t.bairro) && <p className="pn-pendente-info">Local: {[t.endereco, t.bairro].filter(Boolean).join(' — ')}</p>}
                <div className="pn-status-row">{STATUS_OPCOES.map((s) => <button key={s} className={`pn-status-pill ${t.status === s ? 'ativo' : ''}`} style={t.status === s ? { background: STATUS_COR_MAP[s] } : {}} onClick={() => mudarStatus(t, s)}>{s}</button>)}</div>
                <div className="pn-linha-acoes">
                  <button className="pn-mini-btn" onClick={() => abrirEdicao(t)}><Pencil size={13} /> Editar</button>
                  {removendoEsta ? (
                    <div className="pn-confirma">Remover?<button onClick={() => confirmarRemocao(t)}>Sim</button><button className="cancelar" onClick={() => setRemovendo(null)}>Não</button></div>
                  ) : (
                    <button className="pn-mini-btn remover" onClick={() => setRemovendo({ institucaoId: t.institucaoId, id: t.id })}><Trash2 size={13} /> Remover</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>
      )}

      <p className="pn-rodape">{usuario.papel === 'admin' ? 'Conta de administrador — acesso a todas as instituições.' : 'Sua conta só edita as turmas desta instituição.'}</p>
    </div>
  );
}
