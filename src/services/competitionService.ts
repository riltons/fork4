import { supabase } from '@/lib/supabase';

export interface Competition {
    id: string;
    name: string;
    description: string;
    community_id: string;
    start_date: string;
    created_at: string;
    status: 'pending' | 'in_progress' | 'finished';
}

export interface CreateCompetitionDTO {
    name: string;
    description: string;
    community_id: string;
    start_date: string;
}

export interface CompetitionResult {
    players: {
        id: string;
        name: string;
        score: number;
        wins: number;
        losses: number;
        buchudas: number;
        buchudasDeRe: number;
    }[];
    pairs: {
        players: string[];
        score: number;
        wins: number;
        losses: number;
        buchudas: number;
        buchudasDeRe: number;
    }[];
}

export const competitionService = {
    async create(data: CreateCompetitionDTO) {
        try {
            console.log('Criando competição:', data);
            const { data: newCompetition, error } = await supabase
                .from('competitions')
                .insert([{
                    ...data,
                    start_date: new Date().toISOString()
                }])
                .select('*')
                .single();

            if (error) {
                console.error('Erro Supabase:', error);
                throw error;
            }
            
            console.log('Competição criada:', newCompetition);
            return newCompetition;
        } catch (error) {
            console.error('Erro ao criar competição:', error);
            throw error;
        }
    },

    async refreshCompetitions(communityId: string) {
        try {
            const { data: competitions, error } = await supabase
                .from('competitions')
                .select('*')
                .eq('community_id', communityId)
                .order('start_date', { ascending: true });

            if (error) {
                console.error('Erro ao buscar competições:', error);
                throw new Error('Erro ao buscar competições');
            }

            return competitions;
        } catch (error) {
            console.error('Erro ao buscar competições:', error);
            throw error;
        }
    },

    async listByCommunity(communityId: string) {
        try {
            const { data, error } = await supabase
                .from('competitions')
                .select('*')
                .eq('community_id', communityId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao listar competições:', error);
            throw error;
        }
    },

    async getById(id: string) {
        try {
            const { data, error } = await supabase
                .from('competitions')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao buscar competição:', error);
            throw error;
        }
    },

    async listMembers(competitionId: string) {
        try {
            // Busca os membros
            const { data: members, error: membersError } = await supabase
                .from('competition_members')
                .select(`
                    competition_id,
                    player_id,
                    id
                `)
                .eq('competition_id', competitionId);

            if (membersError) {
                console.error('Erro ao buscar membros:', membersError);
                throw membersError;
            }

            if (!members || members.length === 0) {
                return [];
            }

            // Busca os jogadores
            const { data: players, error: playersError } = await supabase
                .from('players')
                .select('id, name, phone')
                .in('id', members.map(m => m.player_id));

            if (playersError) {
                console.error('Erro ao buscar jogadores:', playersError);
                throw playersError;
            }

            // Retorna apenas os membros que têm jogadores correspondentes
            const result = members
                .filter(member => players?.some(p => p.id === member.player_id))
                .map(member => ({
                    ...member,
                    players: players?.find(p => p.id === member.player_id)!
                }));

            console.log('Membros encontrados:', result);
            return result;
        } catch (error) {
            console.error('Erro ao listar membros da competição:', error);
            throw error;
        }
    },

    async addMember(competitionId: string, playerId: string) {
        try {
            console.log('Adicionando membro:', { competitionId, playerId });
            const { data, error } = await supabase
                .from('competition_members')
                .insert([{
                    competition_id: competitionId,
                    player_id: playerId
                }])
                .select();

            console.log('Resposta:', { data, error });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao adicionar membro à competição:', error);
            throw error;
        }
    },

    async removeMember(competitionId: string, playerId: string) {
        try {
            const { error } = await supabase
                .from('competition_members')
                .delete()
                .eq('competition_id', competitionId)
                .eq('player_id', playerId);

            if (error) throw error;
        } catch (error) {
            console.error('Erro ao remover membro da competição:', error);
            throw error;
        }
    },

    async startCompetition(id: string) {
        try {
            const { data, error } = await supabase
                .from('competitions')
                .update({ status: 'in_progress' })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao iniciar competição:', error);
            throw error;
        }
    },

    async getPlayerById(playerId: string) {
        try {
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .eq('id', playerId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao buscar jogador:', error);
            throw error;
        }
    },

    async canFinishCompetition(id: string): Promise<boolean> {
        try {
            const { data: games, error } = await supabase
                .from('games')
                .select('status')
                .eq('competition_id', id);

            if (error) throw error;
            if (!games || games.length === 0) return false;

            // Verifica se há pelo menos um jogo finalizado
            const hasFinishedGames = games.some(game => game.status === 'finished');
            
            // Verifica se não há jogos pendentes ou em andamento
            const hasUnfinishedGames = games.some(game => 
                game.status === 'pending' || game.status === 'in_progress'
            );

            // Só pode encerrar se tiver jogos finalizados E não tiver jogos não finalizados
            return hasFinishedGames && !hasUnfinishedGames;
        } catch (error) {
            console.error('Erro ao verificar status da competição:', error);
            throw error;
        }
    },

    async finishCompetition(id: string): Promise<CompetitionResult> {
        try {
            // Busca todos os jogos da competição
            const { data: games, error: gamesError } = await supabase
                .from('games')
                .select('*')
                .eq('competition_id', id);

            if (gamesError) throw gamesError;

            // Inicializa os resultados
            const playerStats: Record<string, {
                score: number;
                wins: number;
                losses: number;
                buchudas: number;
                buchudasDeRe: number;
                pairs: Set<string>;
            }> = {};

            const pairStats: Record<string, {
                score: number;
                wins: number;
                losses: number;
                buchudas: number;
                buchudasDeRe: number;
            }> = {};

            // Processa cada jogo
            for (const game of games) {
                if (game.status !== 'finished') continue;

                // Inicializa estatísticas dos jogadores se necessário
                [...game.team1, ...game.team2].forEach(playerId => {
                    if (!playerStats[playerId]) {
                        playerStats[playerId] = {
                            score: 0,
                            wins: 0,
                            losses: 0,
                            buchudas: 0,
                            buchudasDeRe: 0,
                            pairs: new Set()
                        };
                    }
                });

                // Cria chaves para as duplas
                const team1Key = game.team1.sort().join('_');
                const team2Key = game.team2.sort().join('_');

                // Inicializa estatísticas das duplas se necessário
                if (!pairStats[team1Key]) {
                    pairStats[team1Key] = {
                        score: 0,
                        wins: 0,
                        losses: 0,
                        buchudas: 0,
                        buchudasDeRe: 0
                    };
                }
                if (!pairStats[team2Key]) {
                    pairStats[team2Key] = {
                        score: 0,
                        wins: 0,
                        losses: 0,
                        buchudas: 0,
                        buchudasDeRe: 0
                    };
                }

                // Registra as duplas para cada jogador
                game.team1.forEach(playerId => {
                    playerStats[playerId].pairs.add(team1Key);
                });
                game.team2.forEach(playerId => {
                    playerStats[playerId].pairs.add(team2Key);
                });

                // Atualiza estatísticas baseado no resultado
                if (game.team1_score > game.team2_score) {
                    // Time 1 venceu
                    game.team1.forEach(playerId => {
                        playerStats[playerId].wins++;
                        playerStats[playerId].score += game.team1_score;
                    });
                    game.team2.forEach(playerId => {
                        playerStats[playerId].losses++;
                        playerStats[playerId].score += game.team2_score;
                    });
                    pairStats[team1Key].wins++;
                    pairStats[team1Key].score += game.team1_score;
                    pairStats[team2Key].losses++;
                    pairStats[team2Key].score += game.team2_score;

                    // Buchuda normal (6x0)
                    if (game.team1_score === 6 && game.team2_score === 0) {
                        game.team1.forEach(playerId => playerStats[playerId].buchudas++);
                        pairStats[team1Key].buchudas++;
                    }
                    // Buchuda de Ré (time 1 estava perdendo de 5x0 e virou)
                    if (game.team1_was_losing_5_0) {
                        game.team1.forEach(playerId => playerStats[playerId].buchudasDeRe++);
                        pairStats[team1Key].buchudasDeRe++;
                    }
                } else {
                    // Time 2 venceu
                    game.team2.forEach(playerId => {
                        playerStats[playerId].wins++;
                        playerStats[playerId].score += game.team2_score;
                    });
                    game.team1.forEach(playerId => {
                        playerStats[playerId].losses++;
                        playerStats[playerId].score += game.team1_score;
                    });
                    pairStats[team2Key].wins++;
                    pairStats[team2Key].score += game.team2_score;
                    pairStats[team1Key].losses++;
                    pairStats[team1Key].score += game.team1_score;

                    // Buchuda normal (6x0)
                    if (game.team2_score === 6 && game.team1_score === 0) {
                        game.team2.forEach(playerId => playerStats[playerId].buchudas++);
                        pairStats[team2Key].buchudas++;
                    }
                    // Buchuda de Ré (time 2 estava perdendo de 5x0 e virou)
                    if (game.team2_was_losing_5_0) {
                        game.team2.forEach(playerId => playerStats[playerId].buchudasDeRe++);
                        pairStats[team2Key].buchudasDeRe++;
                    }
                }
            }

            // Busca os nomes dos jogadores
            const playerIds = Object.keys(playerStats);
            const players = await Promise.all(
                playerIds.map(async (id) => {
                    const player = await this.getPlayerById(id);
                    return {
                        id,
                        name: player.name,
                        score: playerStats[id].score,
                        wins: playerStats[id].wins,
                        losses: playerStats[id].losses,
                        buchudas: playerStats[id].buchudas,
                        buchudasDeRe: playerStats[id].buchudasDeRe
                    };
                })
            );

            // Formata as estatísticas das duplas
            const pairs = Object.entries(pairStats).map(([key, stats]) => ({
                players: key.split('_'),
                ...stats
            }));

            // Atualiza o status da competição para finished
            const { error: updateError } = await supabase
                .from('competitions')
                .update({ status: 'finished' })
                .eq('id', id);

            if (updateError) throw updateError;

            return {
                players: players.sort((a, b) => {
                    // 1. Mais vitórias
                    if (a.wins !== b.wins) return b.wins - a.wins;
                    
                    // 2. Menos derrotas
                    if (a.losses !== b.losses) return a.losses - b.losses;
                    
                    // 3. Mais pontos
                    if (a.score !== b.score) return b.score - a.score;
                    
                    // 4. Mais buchudas dadas
                    if (a.buchudas !== b.buchudas) return b.buchudas - a.buchudas;
                    
                    // 5. Mais buchudas de Ré dadas
                    if (a.buchudasDeRe !== b.buchudasDeRe) return b.buchudasDeRe - a.buchudasDeRe;
                    
                    return 0;
                }),
                pairs: pairs.sort((a, b) => {
                    // Mantém a mesma lógica para as duplas
                    if (a.wins !== b.wins) return b.wins - a.wins;
                    if (a.losses !== b.losses) return a.losses - b.losses;
                    if (a.score !== b.score) return b.score - a.score;
                    if (a.buchudas !== b.buchudas) return b.buchudas - a.buchudas;
                    if (a.buchudasDeRe !== b.buchudasDeRe) return b.buchudasDeRe - a.buchudasDeRe;
                    return 0;
                })
            };
        } catch (error) {
            console.error('Erro ao finalizar competição:', error);
            throw error;
        }
    },

    async getCompetitionResults(id: string): Promise<CompetitionResult> {
        try {
            const { data: competition, error: competitionError } = await supabase
                .from('competitions')
                .select('status')
                .eq('id', id)
                .single();

            if (competitionError) throw competitionError;
            if (competition.status !== 'finished') {
                throw new Error('Competição não está finalizada');
            }

            return this.finishCompetition(id);
        } catch (error) {
            console.error('Erro ao buscar resultados:', error);
            throw error;
        }
    }
};
