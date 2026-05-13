-- ============================================
-- CLÍNICA VIDA+ — Schema Supabase
-- Cole no SQL Editor do Supabase e execute
-- ============================================

-- Tabela de perfis (equipe interna)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin','coordenador','medico','recepcionista')),
  crp_crm TEXT,
  especialidade TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cpf TEXT,
  telefone TEXT,
  data_nascimento DATE,
  convenio TEXT,
  numero_convenio TEXT,
  validade_convenio DATE,
  medico_id UUID REFERENCES profiles(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de consultas
CREATE TABLE IF NOT EXISTS consultas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES pacientes(id) NOT NULL,
  medico_id UUID REFERENCES profiles(id) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Psicoterapia',
  data DATE NOT NULL,
  hora TIME NOT NULL,
  status TEXT DEFAULT 'aguardando' CHECK (
    status IN ('aguardando','confirmada','realizada','cancelada','cancelamento_pendente','reagendamento_pendente')
  ),
  criado_por UUID REFERENCES profiles(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de solicitações (cancelamento/reagendamento)
CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consulta_id UUID REFERENCES consultas(id) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('cancelamento','reagendamento')),
  nova_data DATE,
  nova_hora TIME,
  motivo TEXT,
  aprovado_medico BOOLEAN,
  aprovado_admin BOOLEAN,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','recusada')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de mensagens do chat
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES pacientes(id) NOT NULL,
  remetente TEXT NOT NULL CHECK (remetente IN ('paciente','clinica')),
  conteudo TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de documentos
CREATE TABLE IF NOT EXISTS documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES pacientes(id) NOT NULL,
  medico_id UUID REFERENCES profiles(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('laudo','relatorio','ficha','prontuario','encaminhamento')),
  url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados (equipe interna) têm acesso total
CREATE POLICY "Equipe acessa profiles" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Equipe acessa pacientes" ON pacientes FOR ALL TO authenticated USING (true);
CREATE POLICY "Equipe acessa consultas" ON consultas FOR ALL TO authenticated USING (true);
CREATE POLICY "Equipe acessa solicitacoes" ON solicitacoes FOR ALL TO authenticated USING (true);
CREATE POLICY "Equipe acessa mensagens" ON mensagens FOR ALL TO authenticated USING (true);
CREATE POLICY "Equipe acessa documentos" ON documentos FOR ALL TO authenticated USING (true);

-- ============================================
-- REALTIME (para o chat funcionar ao vivo)
-- ============================================

-- No painel Supabase vá em:
-- Database > Replication > Tables
-- Ative o Realtime para a tabela: mensagens

-- ============================================
-- CRIAR PRIMEIRO ADMIN (execute depois)
-- ============================================
-- 1. Crie o usuário em: Authentication > Users > Add user
-- 2. Copie o UUID gerado
-- 3. Execute:
--
-- INSERT INTO profiles (id, nome, email, tipo)
-- VALUES ('UUID_DO_USUARIO', 'Seu Nome', 'seu@email.com', 'admin');

-- ============================================
-- TABELA RESULTADOS
-- ============================================

CREATE TABLE IF NOT EXISTS resultados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES pacientes(id) NOT NULL,
  medico_id UUID REFERENCES profiles(id),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outro',
  conteudo TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tipo TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe acessa resultados" ON resultados FOR ALL TO authenticated USING (true);

-- Storage bucket para arquivos de resultados
-- No painel Supabase vá em Storage > New Bucket
-- Nome: resultados | Public: true