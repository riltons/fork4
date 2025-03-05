-- Script para reverter as execuções de SQL feitas após o commit restaurado

-- 1. Reverter alterações nas políticas de user_roles
DROP POLICY IF EXISTS "Permitir leitura para todos os usuários autenticados" ON public.user_roles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios papéis" ON public.user_roles;
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios papéis" ON public.user_roles;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios papéis" ON public.user_roles;

-- Restaurar políticas originais de user_roles (se necessário)
CREATE POLICY "Usuários podem ver seus próprios papéis"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Administradores podem gerenciar papéis"
    ON public.user_roles
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    ));

-- 2. Reverter alterações nas políticas de community_members
DROP POLICY IF EXISTS "community_members_select_policy" ON community_members;
DROP POLICY IF EXISTS "community_members_insert_policy" ON community_members;
DROP POLICY IF EXISTS "community_members_delete_policy" ON community_members;
DROP POLICY IF EXISTS "Permitir select para membros e organizadores" ON community_members;

-- Restaurar políticas originais de community_members
CREATE POLICY "Permitir select para membros e organizadores"
ON community_members FOR SELECT
USING (
    EXISTS (
        -- Usuário é organizador da comunidade
        SELECT 1 FROM community_organizers 
        WHERE community_id = community_members.community_id
        AND user_id = auth.uid()
    ) OR
    EXISTS (
        -- Usuário é dono de algum jogador da comunidade
        SELECT 1 FROM players p 
        WHERE p.created_by = auth.uid()
        AND p.id = community_members.player_id
    )
);

CREATE POLICY "Permitir insert para organizadores"
ON community_members FOR INSERT
WITH CHECK (
    EXISTS (
        -- Usuário é organizador da comunidade
        SELECT 1 FROM community_organizers 
        WHERE community_id = community_members.community_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Permitir delete para organizadores"
ON community_members FOR DELETE
USING (
    EXISTS (
        -- Usuário é organizador da comunidade
        SELECT 1 FROM community_organizers 
        WHERE community_id = community_members.community_id
        AND user_id = auth.uid()
    )
);

-- 3. Reverter alterações nas políticas de players
DROP POLICY IF EXISTS "Ver jogadores" ON public.players;
DROP POLICY IF EXISTS "Atualizar jogadores" ON public.players;
DROP POLICY IF EXISTS "Adicionar jogadores" ON public.players;
DROP POLICY IF EXISTS "Remover jogadores" ON public.players;

-- Restaurar políticas originais de players (baseado nas políticas anteriores)
CREATE POLICY "Ver jogadores"
    ON public.players
    FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Atualizar jogadores"
    ON public.players
    FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Adicionar jogadores"
    ON public.players
    FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Remover jogadores"
    ON public.players
    FOR DELETE
    USING (created_by = auth.uid());

-- 4. Reverter alterações nas políticas de competition_members
DROP POLICY IF EXISTS "Qualquer um pode ler membros da competição" ON competition_members;
DROP POLICY IF EXISTS "Qualquer um pode adicionar membros à competição" ON competition_members;
DROP POLICY IF EXISTS "Qualquer um pode remover membros da competição" ON competition_members;
DROP POLICY IF EXISTS "Membros da comunidade podem ler membros da competição" ON competition_members;
DROP POLICY IF EXISTS "Membros da comunidade podem adicionar membros à competição" ON competition_members;
DROP POLICY IF EXISTS "Membros da comunidade podem remover membros da competição" ON competition_members;

-- Restaurar políticas originais de competition_members
CREATE POLICY "Membros da comunidade podem ler membros da competição"
    ON competition_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM community_members cm
            JOIN competitions c ON c.community_id = cm.community_id
            WHERE c.id = competition_members.competition_id
            AND cm.player_id = auth.uid()
        )
    );

CREATE POLICY "Membros da comunidade podem adicionar membros à competição"
    ON competition_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM community_members cm
            JOIN competitions c ON c.community_id = cm.community_id
            WHERE c.id = competition_members.competition_id
            AND cm.player_id = auth.uid()
        )
        AND
        EXISTS (
            SELECT 1 
            FROM community_members cm2
            JOIN competitions c2 ON c2.community_id = cm2.community_id
            WHERE c2.id = competition_members.competition_id
            AND cm2.player_id = competition_members.player_id
        )
    );

CREATE POLICY "Membros da comunidade podem remover membros da competição"
    ON competition_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 
            FROM community_members cm
            JOIN competitions c ON c.community_id = cm.community_id
            WHERE c.id = competition_members.competition_id
            AND cm.player_id = auth.uid()
        )
    );

-- 5. Reverter alterações nas políticas de competitions
DROP POLICY IF EXISTS "Permitir todas operações para usuários autenticados" ON competitions;

-- Restaurar políticas originais de competitions
CREATE POLICY "Membros podem ler competições"
    ON competitions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = competitions.community_id
            AND community_members.player_id = auth.uid()
        )
    );

CREATE POLICY "Membros podem criar competições"
    ON competitions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = community_id
            AND community_members.player_id = auth.uid()
        )
    );

CREATE POLICY "Membros podem atualizar competições"
    ON competitions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = competitions.community_id
            AND community_members.player_id = auth.uid()
        )
    );

CREATE POLICY "Membros podem deletar competições"
    ON competitions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_members.community_id = competitions.community_id
            AND community_members.player_id = auth.uid()
        )
    );