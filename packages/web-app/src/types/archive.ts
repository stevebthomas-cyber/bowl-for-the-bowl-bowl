// TypeScript types for season archive system

export interface TeamArchiveData {
  id: string;
  name: string;
  roster_id: string;
  treasury: number;
  team_value: number;
  current_team_value: number;
  rerolls: number;
  assistant_coaches: number;
  cheerleaders: number;
  apothecary_hired: boolean;
  dedicated_fans: number;
  wins: number;
  losses: number;
  ties: number;
  league_points: number;
}

export interface PlayerArchiveData {
  id: string;
  name: string;
  position: string;
  number: number;
  movement: number;
  strength: number;
  agility: number;
  passing: number;
  armor_value: number;
  skills: string[];
  touchdowns: number;
  casualties_inflicted: number;
  passing_completions: number;
  interceptions: number;
  deflections: number;
  mvps: number;
  spp: number;
  niggling_injuries: number;
  miss_next_game: boolean;
  status: 'active' | 'injured' | 'dead';
}

export interface MatchArchiveData {
  id: string;
  week: number;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
  home_casualties: number;
  away_casualties: number;
  played_at: string;
  is_playoff: boolean;
}

export interface StatsArchiveSummary {
  total_touchdowns: number;
  total_casualties: number;
  total_completions: number;
  total_interceptions: number;
  total_mvps: number;
  total_spp_earned: number;
  games_played: number;
  final_standing: number;
  final_league_points: number;
  made_playoffs: boolean;
  playoff_result?: 'champion' | 'finalist' | 'semifinalist' | 'eliminated';
}

export interface LeagueSettingsArchive {
  name: string;
  season_status: string;
  max_teams: number;
  divisions: number;
  games_per_season: number;
  win_points: number;
  tie_points: number;
  loss_points: number;
  attendance_threshold: number;
  playoff_format: string;
  playoff_seeding: string;
  home_advantage: boolean;
  rules_config: any;
}

export interface SeasonArchive {
  id: string;
  league_id: string;
  team_id: string;
  season_number: number;
  archived_at: string;
  team_data: TeamArchiveData;
  roster_data: PlayerArchiveData[];
  matches_data: MatchArchiveData[];
  stats_summary: StatsArchiveSummary;
  league_settings: LeagueSettingsArchive;
  created_at: string;
  updated_at: string;
}
