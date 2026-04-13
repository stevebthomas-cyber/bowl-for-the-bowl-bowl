# Blood Bowl League Management System (BBLMS)
## Comprehensive Project Documentation

**Version:** 1.0  
**Last Updated:** November 5, 2025  
**Status:** Draft for Implementation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Model](#2-data-model)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Workflows](#4-workflows)
5. [System Interfaces](#5-system-interfaces)
6. [Implementation Phases](#6-implementation-phases)
7. [Technical Architecture](#7-technical-architecture)
8. [Appendices](#8-appendices)

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose & Goals

The Blood Bowl League Management System (BBLMS) is a dual-interface platform designed to manage casual, in-person Blood Bowl tabletop leagues with custom rules including Secret Objective Bonuses (SOBs), Guest Coach Bounties, and personalized AI assistant coaches.

#### Core Principles
- Reduce administrative burden on coaches and commissioners
- Make compliance fun through conversational AI assistants
- Reward participation and sportsmanship, not just winning
- Handle life's interruptions gracefully (Guest Coach system)
- Support highly customized league rules

#### Key Features
- Personalized AI assistant coach for each team (conversational workflow guidance)
- Automated reminders and deadline management
- Guest Coach bounty system for missed games
- Custom SOB (Secret Objective Bonus) tracking and review
- Season-to-season team persistence with redraft mechanics
- Mobile-first web interface + Discord bot

### 1.2 Key Actors

| Role | Description | Key Responsibilities |
|------|-------------|---------------------|
| **Commissioner** | League administrator and final authority | Configure league rules, create schedule, arbitrate disputes, manage SOBs |
| **Assistant Commissioner** | Co-administrator with limited override powers | Day-to-day admin, tie-breaking when Commissioner is conflicted |
| **Coach** | Team owner and primary operator | Manage team roster, report games, submit SOBs, vote on awards |
| **Assistant Coach (Human)** | Delegated helper for a specific team | Can manage roster and submit reports on behalf of Coach |
| **Guest Coach** | Temporary stand-in for one game | Plays one specific match, earns bounty rewards |
| **Assistant Coach (AI Bot)** | Personalized conversational interface per team | Guide coach through workflows, reminders, personality-driven interactions |
| **Visitor Team Coach** | Anyone using the default static roster team | Can play using "Visitors" team without owning a team |

### 1.3 System Boundaries

#### In Scope
- Team and player roster management
- Match scheduling and reporting
- SOB proposal, review, and tracking
- Award calculations and voting
- Guest Coach bounty system
- Season initialization and closure
- AI assistant coach personalities
- Discord bot interface
- Mobile-responsive web application

#### Out of Scope
- Integration with official Blood Bowl video games (BB2, BB3)
- Real-time during-game tracking (optional future feature)
- Cross-league statistics or global rankings
- Matchmaking or opponent-finding for online play
- Physical miniature inventory management
- Payment processing for league fees

### 1.4 Installation Model

- **Single-league installations** - each league is a separate deployment
- **No cross-league statistics** - focus on individual league community
- **Self-contained data** - all league data in one database instance
- **Replicable setup** - documentation enables other leagues to install their own instance

---

## 2. DATA MODEL

### 2.1 Core Entities Overview

```
LEAGUE
  ↓
  ├─ USERS (Coaches, Commissioners)
  │   └─ USER_ROLES (per league)
  │
  ├─ TEAMS
  │   ├─ TEAM_OWNERSHIP (who owns/assists)
  │   ├─ PLAYERS (on-pitch characters)
  │   ├─ TEAM_SOBs (active objectives)
  │   └─ ASSISTANT_COACH_CONFIG (personality)
  │
  ├─ MATCHES
  │   ├─ MATCH_PARTICIPANTS (teams + coaches)
  │   ├─ GUEST_COACH_SESSIONS
  │   ├─ MATCH_REPORTS (results)
  │   └─ MATCH_EVENTS (touchdowns, casualties, etc.)
  │
  ├─ SCHEDULE (when matches happen)
  │
  ├─ SOBs
  │   ├─ SOB_DEFINITIONS (proposed objectives)
  │   ├─ SOB_REVIEWS (approval process)
  │   └─ SOB_ACHIEVEMENTS (completed objectives)
  │
  ├─ BOUNTIES
  │   └─ BOUNTY_CLAIMS
  │
  ├─ AWARDS
  │   └─ AWARD_VOTES
  │
  └─ AUDIT_LOG (all actions)
```

### 2.2 Database Schema

#### LEAGUES Table

```sql
leagues
  id                    UUID PRIMARY KEY
  name                  VARCHAR(255) NOT NULL
  commissioner_id       UUID NOT NULL REFERENCES users(id)
  asst_commissioner_id  UUID REFERENCES users(id)
  season_number         INTEGER NOT NULL DEFAULT 1
  season_status         ENUM('setup', 'active', 'playoffs', 'closed') NOT NULL
  created_at            TIMESTAMP NOT NULL
  current_season_start  TIMESTAMP
  current_season_end    TIMESTAMP
  
  -- League Configuration (JSONB for flexibility)
  rules_config          JSONB NOT NULL
    /* Example structure:
    {
      "max_teams": 8,
      "min_teams": 4,
      "divisions": 2,
      "games_per_season": 10,
      "attendance_threshold": 0.20,
      "scoring": {"win": 3, "tie": 1, "loss": 0},
      "sob_formula": "log({tier})+2*({points}/10)",
      "draft_picks": {
        "1": {"spp": 28, "dedicated_fans": 1},
        "2": {"spp": 20},
        "3": {"spp": 16}
      }
    }
    */
```

#### USERS Table

```sql
users
  id              UUID PRIMARY KEY
  discord_id      VARCHAR(255) UNIQUE NOT NULL
  discord_username VARCHAR(255) NOT NULL
  display_name    VARCHAR(255)
  email           VARCHAR(255)
  created_at      TIMESTAMP NOT NULL
  last_active     TIMESTAMP
```

#### USER_ROLES Table

```sql
user_roles
  id          UUID PRIMARY KEY
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
  role        ENUM('commissioner', 'asst_commissioner', 'coach') NOT NULL
  granted_at  TIMESTAMP NOT NULL
  granted_by  UUID REFERENCES users(id)
  
  UNIQUE(league_id, user_id, role)
```

#### TEAMS Table

```sql
teams
  id                  UUID PRIMARY KEY
  league_id           UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  name                VARCHAR(255) NOT NULL
  race                VARCHAR(100) NOT NULL
  tier                INTEGER NOT NULL
  division            INTEGER
  
  -- Financial
  treasury            INTEGER NOT NULL DEFAULT 0
  team_value          INTEGER NOT NULL DEFAULT 0
  
  -- Fans & Rerolls
  dedicated_fans      INTEGER NOT NULL DEFAULT 0
  min_dedicated_fans  INTEGER NOT NULL DEFAULT 1
  rerolls             INTEGER NOT NULL DEFAULT 0
  
  -- Season Tracking
  season_created      INTEGER NOT NULL
  active              BOOLEAN NOT NULL DEFAULT true
  
  -- Record
  wins                INTEGER NOT NULL DEFAULT 0
  losses              INTEGER NOT NULL DEFAULT 0
  ties                INTEGER NOT NULL DEFAULT 0
  league_points       INTEGER NOT NULL DEFAULT 0
  
  -- SOB Tracking
  total_sobs          INTEGER NOT NULL DEFAULT 0
  
  -- Meta
  created_at          TIMESTAMP NOT NULL
  updated_at          TIMESTAMP NOT NULL
  
  UNIQUE(league_id, name)
```

#### TEAM_OWNERSHIP Table

```sql
team_ownership
  id                  UUID PRIMARY KEY
  team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
  role                ENUM('owner', 'assistant_coach') NOT NULL
  can_modify_roster   BOOLEAN NOT NULL DEFAULT true
  can_submit_reports  BOOLEAN NOT NULL DEFAULT true
  granted_at          TIMESTAMP NOT NULL
  granted_by          UUID REFERENCES users(id)
  
  UNIQUE(team_id, user_id)
```

#### PLAYERS Table

```sql
players
  id                UUID PRIMARY KEY
  team_id           UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE
  name              VARCHAR(255) NOT NULL
  position          VARCHAR(100) NOT NULL
  number            INTEGER
  
  -- Stats
  movement          INTEGER NOT NULL
  strength          INTEGER NOT NULL
  agility           INTEGER NOT NULL
  armor_value       INTEGER NOT NULL
  
  -- Skills (array of skill names)
  skills            TEXT[] NOT NULL DEFAULT '{}'
  
  -- Career Stats
  spp               INTEGER NOT NULL DEFAULT 0
  touchdowns        INTEGER NOT NULL DEFAULT 0
  completions       INTEGER NOT NULL DEFAULT 0
  interceptions     INTEGER NOT NULL DEFAULT 0
  casualties        INTEGER NOT NULL DEFAULT 0
  mvp_awards        INTEGER NOT NULL DEFAULT 0
  
  -- Status
  status            ENUM('active', 'injured', 'suspended', 'dead', 'retired') NOT NULL DEFAULT 'active'
  injury_details    TEXT
  miss_next_game    BOOLEAN NOT NULL DEFAULT false
  
  -- Value
  player_value      INTEGER NOT NULL
  
  -- Meta
  created_at        TIMESTAMP NOT NULL
  season_joined     INTEGER NOT NULL
  
  UNIQUE(team_id, number)
```

#### MATCHES Table

```sql
matches
  id                  UUID PRIMARY KEY
  league_id           UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  season_number       INTEGER NOT NULL
  match_number        INTEGER NOT NULL
  
  -- Teams
  home_team_id        UUID NOT NULL REFERENCES teams(id)
  away_team_id        UUID NOT NULL REFERENCES teams(id)
  
  -- Scheduling
  scheduled_date      TIMESTAMP NOT NULL
  location            VARCHAR(255)
  
  -- Status
  status              ENUM('scheduled', 'bounty_posted', 'in_progress', 'completed', 'conceded', 'cancelled') NOT NULL DEFAULT 'scheduled'
  
  -- Results (null until completed)
  home_score          INTEGER
  away_score          INTEGER
  completed_at        TIMESTAMP
  
  -- Special Cases
  is_civil_war        BOOLEAN NOT NULL DEFAULT false
  conceded_by_team_id UUID REFERENCES teams(id)
  under_review        BOOLEAN NOT NULL DEFAULT false
  
  -- Meta
  created_at          TIMESTAMP NOT NULL
  updated_at          TIMESTAMP NOT NULL
  
  UNIQUE(league_id, season_number, match_number)
  CHECK (home_team_id != away_team_id)
```

#### MATCH_PARTICIPANTS Table

```sql
match_participants
  id              UUID PRIMARY KEY
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE
  team_id         UUID NOT NULL REFERENCES teams(id)
  user_id         UUID NOT NULL REFERENCES users(id)
  role            ENUM('coach', 'guest_coach') NOT NULL
  side            ENUM('home', 'away') NOT NULL
  
  -- Attendance tracking
  confirmed_attendance BOOLEAN NOT NULL DEFAULT false
  confirmed_at        TIMESTAMP
  no_show             BOOLEAN NOT NULL DEFAULT false
  
  UNIQUE(match_id, team_id)
```

#### GUEST_COACH_SESSIONS Table

```sql
guest_coach_sessions
  id                UUID PRIMARY KEY
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE
  team_id           UUID NOT NULL REFERENCES teams(id)
  guest_user_id     UUID REFERENCES users(id)
  
  -- Bounty Details
  bounty_amount     INTEGER NOT NULL
  bonus_amount      INTEGER NOT NULL
  win_bonus_paid    BOOLEAN NOT NULL DEFAULT false
  
  -- Status
  status            ENUM('posted', 'claimed', 'completed', 'expired') NOT NULL DEFAULT 'posted'
  posted_at         TIMESTAMP NOT NULL
  claimed_at        TIMESTAMP
  completed_at      TIMESTAMP
  expires_at        TIMESTAMP NOT NULL
  
  -- Access control
  can_view_sobs     BOOLEAN NOT NULL DEFAULT false
  
  UNIQUE(match_id, team_id)
```

#### MATCH_REPORTS Table

```sql
match_reports
  id              UUID PRIMARY KEY
  match_id        UUID UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE
  
  -- Submitted by
  submitted_by    UUID NOT NULL REFERENCES users(id)
  submitted_role  VARCHAR(50) NOT NULL
  submitted_at    TIMESTAMP NOT NULL
  
  -- Game Details
  weather         VARCHAR(100)
  kickoff_event   VARCHAR(100)
  
  -- Narrative (optional)
  match_summary   TEXT
  
  -- Verification
  verified        BOOLEAN NOT NULL DEFAULT false
  verified_by     UUID REFERENCES users(id)
  verified_at     TIMESTAMP
```

#### MATCH_EVENTS Table

```sql
match_events
  id              UUID PRIMARY KEY
  match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE
  player_id       UUID REFERENCES players(id)
  team_id         UUID NOT NULL REFERENCES teams(id)
  
  event_type      ENUM('touchdown', 'completion', 'interception', 'casualty', 'mvp') NOT NULL
  target_player_id UUID REFERENCES players(id)  -- For completions (who caught) or casualties (who was injured)
  
  spp_awarded     INTEGER NOT NULL DEFAULT 0
  turn_number     INTEGER
  half            INTEGER
  
  created_at      TIMESTAMP NOT NULL
```

#### SOB_DEFINITIONS Table

```sql
sob_definitions
  id              UUID PRIMARY KEY
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE
  season_number   INTEGER NOT NULL
  
  -- SOB Details
  title           VARCHAR(255) NOT NULL
  description     TEXT NOT NULL
  timeframe       ENUM('season', 'game', 'half', 'your_play', 'opponent_play') NOT NULL
  points_value    INTEGER NOT NULL CHECK (points_value >= 1 AND points_value <= 128)
  
  -- Review Status
  status          ENUM('proposed', 'under_review', 'approved', 'rejected') NOT NULL DEFAULT 'proposed'
  review_notes    TEXT
  
  -- Tracking
  times_achieved  INTEGER NOT NULL DEFAULT 0
  
  -- Meta
  created_at      TIMESTAMP NOT NULL
  approved_at     TIMESTAMP
  
  UNIQUE(team_id, season_number, title)
```

#### SOB_REVIEWS Table

```sql
sob_reviews
  id                  UUID PRIMARY KEY
  sob_definition_id   UUID NOT NULL REFERENCES sob_definitions(id) ON DELETE CASCADE
  reviewer_user_id    UUID NOT NULL REFERENCES users(id)
  
  decision            ENUM('approve', 'amend', 'arbitrate') NOT NULL
  amended_title       VARCHAR(255)
  amended_description TEXT
  amended_points      INTEGER
  notes               TEXT
  
  reviewed_at         TIMESTAMP NOT NULL
  
  UNIQUE(sob_definition_id, reviewer_user_id)
```

#### SOB_ACHIEVEMENTS Table

```sql
sob_achievements
  id                  UUID PRIMARY KEY
  sob_definition_id   UUID NOT NULL REFERENCES sob_definitions(id) ON DELETE CASCADE
  player_id           UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE
  match_id            UUID REFERENCES matches(id) ON DELETE SET NULL
  
  -- SOB Conversion
  raw_points          INTEGER NOT NULL
  converted_sobs      INTEGER NOT NULL
  
  achieved_at         TIMESTAMP NOT NULL
  
  -- Verification
  verified            BOOLEAN NOT NULL DEFAULT false
  verified_by         UUID REFERENCES users(id)
```

#### BOUNTIES Table

```sql
bounties
  id                UUID PRIMARY KEY
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE
  team_id           UUID NOT NULL REFERENCES teams(id)
  
  bounty_type       ENUM('no_show', 'civil_war', 'bonus') NOT NULL
  base_amount       INTEGER NOT NULL
  bonus_amount      INTEGER NOT NULL DEFAULT 0
  additional_incentives TEXT
  
  status            ENUM('active', 'claimed', 'expired', 'cancelled') NOT NULL DEFAULT 'active'
  
  posted_at         TIMESTAMP NOT NULL
  posted_by         UUID REFERENCES users(id)
  expires_at        TIMESTAMP
  
  claimed_by        UUID REFERENCES users(id)
  claimed_at        TIMESTAMP
```

#### SCHEDULES Table

```sql
schedules
  id                UUID PRIMARY KEY
  league_id         UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  season_number     INTEGER NOT NULL
  
  -- Schedule metadata
  start_date        DATE NOT NULL
  end_date          DATE NOT NULL
  playoff_start     DATE
  
  -- Configuration
  schedule_data     JSONB NOT NULL
    /* Example structure:
    {
      "weeks": [
        {
          "week_number": 1,
          "date": "2025-11-15",
          "matches": [
            {"home_team_id": "...", "away_team_id": "...", "location": "..."}
          ]
        }
      ]
    }
    */
  
  created_at        TIMESTAMP NOT NULL
  created_by        UUID NOT NULL REFERENCES users(id)
  
  UNIQUE(league_id, season_number)
```

#### ASSISTANT_COACH_CONFIG Table

```sql
assistant_coach_config
  id                UUID PRIMARY KEY
  team_id           UUID UNIQUE NOT NULL REFERENCES teams(id) ON DELETE CASCADE
  
  -- Assistant Details
  name              VARCHAR(255) NOT NULL
  personality_prompt TEXT NOT NULL
  tone              VARCHAR(50) DEFAULT 'friendly'
  strictness        VARCHAR(50) DEFAULT 'medium'
  
  -- Usage & Control
  enabled           BOOLEAN NOT NULL DEFAULT true
  token_budget      INTEGER DEFAULT 100000
  tokens_used       INTEGER NOT NULL DEFAULT 0
  
  -- Moderation
  flagged           BOOLEAN NOT NULL DEFAULT false
  flag_reason       TEXT
  
  -- Meta
  created_at        TIMESTAMP NOT NULL
  updated_at        TIMESTAMP NOT NULL
```

#### AWARDS Table

```sql
awards
  id              UUID PRIMARY KEY
  league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  season_number   INTEGER NOT NULL
  
  award_type      VARCHAR(100) NOT NULL
    /* Types:
       Player Awards: nuffles_chosen, chosen_one, nuffles_bolt, nuffles_bulwark, nuffles_wit
       Coach Awards: nuffles_kindness, nuffles_inspiration, nuffles_cup, nuffles_champion, son_daughter_of_nuffle
    */
  
  recipient_type  ENUM('player', 'coach', 'team') NOT NULL
  recipient_id    UUID NOT NULL
  
  awarded_at      TIMESTAMP NOT NULL
  
  UNIQUE(league_id, season_number, award_type)
```

#### AWARD_VOTES Table

```sql
award_votes
  id              UUID PRIMARY KEY
  league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  season_number   INTEGER NOT NULL
  award_type      VARCHAR(100) NOT NULL
  
  voter_user_id   UUID NOT NULL REFERENCES users(id)
  vote_weight     INTEGER NOT NULL DEFAULT 1
  
  nominee_type    ENUM('player', 'coach', 'team') NOT NULL
  nominee_id      UUID NOT NULL
  
  voted_at        TIMESTAMP NOT NULL
  
  UNIQUE(league_id, season_number, award_type, voter_user_id, nominee_id)
```

#### PLAYER_OF_WEEK_SUBMISSIONS Table

```sql
player_of_week_submissions
  id              UUID PRIMARY KEY
  league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  season_number   INTEGER NOT NULL
  week_number     INTEGER NOT NULL
  
  player_id       UUID NOT NULL REFERENCES players(id)
  match_id        UUID NOT NULL REFERENCES matches(id)
  
  story           TEXT NOT NULL
  submitted_by    UUID NOT NULL REFERENCES users(id)
  submitted_at    TIMESTAMP NOT NULL
  
  -- Voting results
  votes_received  INTEGER NOT NULL DEFAULT 0
  winner          BOOLEAN NOT NULL DEFAULT false
  
  UNIQUE(match_id, player_id)
```

#### AUDIT_LOG Table

```sql
audit_log
  id              UUID PRIMARY KEY
  league_id       UUID REFERENCES leagues(id) ON DELETE CASCADE
  
  user_id         UUID NOT NULL REFERENCES users(id)
  role_context    VARCHAR(100) NOT NULL
  
  action_type     VARCHAR(100) NOT NULL
  entity_type     VARCHAR(100)
  entity_id       UUID
  
  changes         JSONB
  ip_address      VARCHAR(45)
  user_agent      TEXT
  
  created_at      TIMESTAMP NOT NULL
  
  INDEX(league_id, created_at)
  INDEX(user_id, created_at)
  INDEX(entity_type, entity_id)
```

#### VISITOR_TEAMS Table

```sql
visitor_teams
  id              UUID PRIMARY KEY
  league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE
  
  -- Static roster configuration
  roster_config   JSONB NOT NULL
    /* Example:
    {
      "race": "Human",
      "tier": 2,
      "players": [
        {"position": "Thrower", "number": 1, "stats": {...}, "skills": [...]},
        ...
      ],
      "rerolls": 3,
      "treasury": 0
    }
    */
  
  created_at      TIMESTAMP NOT NULL
  
  UNIQUE(league_id)
```

### 2.3 Key Relationships

```
USER (1) ──────── (M) USER_ROLES ──────── (1) LEAGUE
USER (1) ──────── (M) TEAM_OWNERSHIP ──── (1) TEAM
USER (1) ──────── (M) MATCH_PARTICIPANTS ─ (1) MATCH

LEAGUE (1) ─────── (M) TEAMS
LEAGUE (1) ─────── (M) MATCHES
LEAGUE (1) ─────── (1) SCHEDULES
LEAGUE (1) ─────── (1) VISITOR_TEAMS

TEAM (1) ────────── (M) PLAYERS
TEAM (1) ────────── (1) ASSISTANT_COACH_CONFIG
TEAM (1) ────────── (M) SOB_DEFINITIONS
TEAM (1) ────────── (M) MATCHES (as home or away)

MATCH (1) ───────── (0..2) GUEST_COACH_SESSIONS
MATCH (1) ───────── (0..1) MATCH_REPORTS
MATCH (1) ───────── (M) MATCH_EVENTS
MATCH (1) ───────── (M) BOUNTIES

PLAYER (1) ──────── (M) SOB_ACHIEVEMENTS
PLAYER (1) ──────── (M) MATCH_EVENTS

SOB_DEFINITION (1) ── (M) SOB_REVIEWS
SOB_DEFINITION (1) ── (M) SOB_ACHIEVEMENTS
```

### 2.4 Data Validation Rules

#### Business Rules

1. **Team Constraints:**
   - Maximum 8 teams per league (configurable)
   - Minimum 4 teams per league (configurable)
   - Teams divided into 2 divisions of equal size
   - Each team must have at least 1 owner

2. **Match Constraints:**
   - A team cannot play itself (except through Guest Coach in civil war)
   - Each match must have exactly 2 teams
   - Scheduled date cannot be in the past (except for admin override)
   - Civil war matches automatically create bounty

3. **Player Constraints:**
   - Player numbers must be unique within a team
   - Player must belong to exactly one team
   - Dead/retired players cannot gain SPP or play matches
   - Player value recalculated based on SPP and skills

4. **SOB Constraints:**
   - Points value must be between 1-128
   - Requires 2 reviewers from different division
   - Reviewers cannot review their own team's SOBs
   - Commissioner breaks ties in arbitration

5. **Guest Coach Constraints:**
   - Cannot be the regular coach of either team in the match
   - Can only be active for one match at a time
   - Session expires 24 hours after match completion
   - Bounty must be posted at least 3 hours before match

6. **Attendance Constraints:**
   - Missing >20% of scheduled games triggers "Under League Review"
   - No-call-no-show automatically posts bounty
   - Must confirm attendance 72 hours before match

7. **Award Constraints:**
   - Can only vote with dedicated fans count as weight
   - Cannot vote for own team/players (except where explicitly allowed)
   - Awards finalized at season end

---

## 3. USER ROLES & PERMISSIONS

### 3.1 Role Definitions

#### Commissioner
- **Description:** League creator and ultimate authority
- **Count:** 1 per league
- **Duration:** Permanent (until transferred)
- **Key Powers:**
  - Create/modify league rules
  - Create/modify schedule
  - Assign reviewers for SOBs
  - Arbitrate SOB disputes
  - Override game results (with audit log)
  - Close/open seasons
  - Manage Assistant Commissioner
  - Moderate assistant coach personalities

#### Assistant Commissioner
- **Description:** Second-in-command with limited override authority
- **Count:** 0-1 per league
- **Duration:** At Commissioner's discretion
- **Key Powers:**
  - All Coach powers
  - Review concessions
  - Tie-breaking in SOB reviews
  - Day-to-day schedule adjustments
  - **Cannot:** Change core league rules, override Commissioner, arbitrate when Commissioner owns a team

#### Coach
- **Description:** Team owner and primary operator
- **Count:** 4-8 per league
- **Duration:** Season-based (can carry forward)
- **Key Powers:**
  - Create/manage team roster
  - Submit game reports
  - Propose SOBs
  - Vote on awards (weighted by dedicated fans)
  - Post bounties for their own no-shows
  - Accept bounties for other matches
  - Configure assistant coach personality

#### Assistant Coach (Human)
- **Description:** Delegated helper for specific team
- **Count:** 0-N per team
- **Duration:** At owner's discretion
- **Key Powers:**
  - Manage team roster (if granted)
  - Submit game reports (if granted)
  - Interact with team's AI assistant
  - **Cannot:** Delete team, transfer ownership, propose SOBs, vote on awards

#### Guest Coach
- **Description:** Temporary one-game substitute
- **Count:** Unlimited (but only 1 active session per person)
- **Duration:** Match-specific (expires 24hr post-game)
- **Key Powers:**
  - View temporary team roster
  - Submit report for that specific match
  - Use "Visitors" team for any match
  - **Cannot:** View SOBs, make permanent roster changes, access team after expiry

### 3.2 Permission Matrix

| Action | Comm. | Asst Comm. | Coach | Asst Coach | Guest Coach |
|--------|-------|------------|-------|------------|-------------|
| **League Management** |
| Create/edit league rules | ✅ | ❌ | ❌ | ❌ | ❌ |
| Open/close season | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create schedule | ✅ | ⚠️ (adjust only) | ❌ | ❌ | ❌ |
| Assign SOB reviewers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Arbitrate SOB disputes | ✅ (if not conflicted) | ⚠️ (tie-break only) | ❌ | ❌ | ❌ |
| Override match results | ✅ | ⚠️ (concessions only) | ❌ | ❌ | ❌ |
| Moderate assistant coaches | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Team Management** |
| Create team | ✅ (admin) | ✅ (admin) | ✅ | ❌ | ❌ |
| Modify own roster | ✅ | ✅ | ✅ | ⚠️ (if granted) | ❌ |
| Delete team | ✅ (admin) | ❌ | ✅ (owner only) | ❌ | ❌ |
| Configure AI assistant | ✅ (override) | ✅ (override) | ✅ | ❌ | ❌ |
| Add assistant coach | ✅ (admin) | ✅ (admin) | ✅ (owner only) | ❌ | ❌ |
| **Match Management** |
| View match schedule | ✅ | ✅ | ✅ | ✅ | ✅ |
| Confirm attendance | ✅ | ✅ | ✅ | ⚠️ (if granted) | N/A |
| Submit match report | ✅ | ✅ | ✅ | ⚠️ (if granted) | ✅ (for session match only) |
| Post bounty (own no-show) | ✅ | ✅ | ✅ | ⚠️ (if granted) | ❌ |
| Post bounty (civil war) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Accept bounty | ⚠️ (if not conflicted) | ⚠️ (if not conflicted) | ✅ | ✅ | ✅ |
| Concede match | ✅ | ✅ | ✅ | ⚠️ (if granted) | ❌ |
| **SOB Management** |
| Propose SOBs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Review SOBs | ⚠️ (not own teams) | ⚠️ (not own teams) | ⚠️ (when assigned, not own) | ❌ | ❌ |
| View own SOBs | ✅ | ✅ | ✅ | ✅ | ❌ |
| View other SOBs | ✅ (all) | ✅ (all) | ⚠️ (only during review) | ❌ | ❌ |
| Log SOB achievement | ✅ | ✅ | ✅ (own team) | ⚠️ (if granted) | ❌ |
| **Awards & Voting** |
| Vote on awards | ✅ (as coach) | ✅ (as coach) | ✅ | ❌ | ❌ |
| Submit Player of Week | ✅ | ✅ | ✅ | ⚠️ (if granted) | ❌ |
| View voting results | ✅ (all) | ✅ (all) | ✅ (after close) | ✅ (after close) | ❌ |
| Finalize awards | ✅ | ⚠️ (suggest only) | ❌ | ❌ | ❌ |
| **Audit & Reports** |
| View audit log | ✅ (all) | ✅ (all) | ⚠️ (own actions) | ⚠️ (own actions) | ❌ |
| Generate reports | ✅ | ✅ | ✅ (own team) | ✅ (assigned team) | ❌ |

**Legend:**
- ✅ = Full permission
- ⚠️ = Conditional permission (see notes)
- ❌ = No permission

### 3.3 Conflict of Interest Rules

#### Automatic Exclusions

1. **SOB Review:**
   - Commissioner/Coach cannot review their own team's SOBs
   - Reviewers must be from different division
   - If <4 eligible reviewers exist, Commissioner arbitrates directly

2. **Civil War Games:**
   - Owner of both teams cannot coach either side
   - Automatic bounty posted by Commissioner
   - Guest coaches must not own either team

3. **Award Voting:**
   - Can vote for own players/team for awards where allowed by rules
   - Commissioner resolves ties (cannot vote in tie-break for own team)

4. **Match Reporting:**
   - Guest coach cannot also be regular coach for either team
   - Concession review excludes the conceding coach

5. **Bounty Claims:**
   - Cannot claim bounty for your own team's match
   - Cannot claim if you own either team in the match

#### Audit Requirements

All actions taken by Commissioners/Assistant Commissioners that affect their own teams must be logged with extra detail:
- Context (acting as Commissioner vs Coach)
- Justification (if override/special action)
- Timestamp and IP address

---

## 4. WORKFLOWS

### 4.1 Setup Workflows

#### 4.1.1 League Initialization

**Trigger:** Commissioner creates new league installation

**Steps:**
1. Commissioner registers via Discord OAuth
2. System creates `league` record with default config
3. Commissioner assigned `commissioner` role
4. Commissioner configures league rules via web app:
   - Max/min teams
   - Number of divisions
   - Scoring rules (win/tie/loss points)
   - SOB formula
   - Draft pick rewards
   - Season structure (weeks, games per team)
5. System creates `visitor_team` with default Human roster
6. League status set to `setup`

**Outputs:**
- League created with unique ID
- Commissioner has admin access
- League URL shareable for coach registration

**Validation:**
- Commissioner must have Discord account
- League name must be unique per installation
- Rules config must pass schema validation

---

#### 4.1.2 Coach Registration

**Trigger:** User wants to join league as coach

**Actors:** Prospective Coach, Commissioner

**Steps:**
1. User joins league Discord server
2. User authenticates via Discord OAuth on web app
3. User requests coach role via `/join-league` command or web form
4. Commissioner approves/denies request
5. If approved:
   - System creates `user_role` with role=`coach`
   - Coach gains access to team creation
   - Coach receives welcome DM from system

**Outputs:**
- User added to league with `coach` role
- Can now create team

**Validation:**
- Maximum coaches not exceeded (default 8)
- User not already a coach in this league
- Commissioner approval required

---

#### 4.1.3 Team Creation

**Trigger:** Coach wants to create a team

**Actors:** Coach, AI Assistant Coach, Commissioner

**Steps:**
1. Coach initiates team creation via Discord bot or web app
2. System prompts for team details:
   - Team name
   - Race selection
   - Starting budget allocation
3. Coach selects players within budget
4. System validates roster against race rules
5. Coach configures AI Assistant Coach personality:
   - Assistant name
   - Personality description
   - Tone & strictness settings
6. System creates:
   - `team` record
   - `team_ownership` record
   - `players` records
   - `assistant_coach_config` record
7. Coach assigned to division (Commissioner can override)
8. AI assistant sends introductory DM

**Outputs:**
- Team created and owned by coach
- Players added to roster
- AI assistant configured
- Team visible in league

**Validation:**
- Team name unique within league
- Roster valid per race rules
- Budget not exceeded
- Maximum teams not exceeded

**Assistant Coach Interaction Example:**
```
Bot: "Alright bud, let's get your team set up! What're we calling this squad?"
Coach: "Gnorthmen"
Bot: "Gnorthmen! Love it, very Canadian. Now, what race are you running with?"
Coach: "Gnomes"
Bot: "Tier 3 team - that means nice SOB bonuses! You've got 1,000,000 gold to work with..."
```

---

#### 4.1.4 Schedule Creation

**Trigger:** Commissioner ready to create season schedule

**Actors:** Commissioner

**Steps:**
1. Commissioner confirms all teams registered (min 4, max 8)
2. Commissioner assigns teams to divisions via web app
3. System validates even division split
4. Commissioner uses "Schedule Wizard" (web app):
   - Set season start date
   - Set number of weeks
   - Select venue rotation
5. System generates schedule:
   - Home-and-home within division (6 games)
   - 4 cross-division games
   - Assigns dates based on weekly cadence
6. Commissioner reviews and adjusts specific matchups/dates
7. Commissioner publishes schedule
8. System:
   - Creates `schedule` record
   - Creates `matches` records for all games
   - Sends notifications to all coaches

**Outputs:**
- Full season schedule created
- All matches have dates/locations
- Coaches notified

**Schedule Algorithm:**
```
FOR each division:
  FOR each team in division:
    Create home-and-home vs all other teams in division (3 opponents × 2 = 6 games)

FOR cross-division matchups:
  Randomly pair 4 teams from Division A with 4 teams from Division B
  Each team plays 4 cross-division games

Total: 6 division + 4 cross-division = 10 regular season games
```

**Validation:**
- All teams have equal number of games
- No team plays itself
- Home/away balance maintained
- Dates don't conflict (no team plays twice same day)

---

#### 4.1.5 SOB Proposal & Review

**Trigger:** Season opened, teams need SOBs defined

**Actors:** Coach, AI Assistant, SOB Reviewers, Commissioner

**Steps:**

**Phase 1: Proposal (Coach + AI Assistant)**
1. AI assistant prompts coach to create 3 SOBs
2. For each SOB, coach defines:
   - Title & description
   - Timeframe (season/game/half/play)
   - Target player (specific or any)
   - Proposed point value
3. AI assistant provides guidance:
   - Suggests point ranges based on difficulty
   - Flags overpowered/underpowered proposals
   - Confirms SOB aligns with team tier/playstyle
4. Coach submits 3 SOBs
5. System creates `sob_definition` records with status=`proposed`

**Phase 2: Assignment (Commissioner)**
6. Commissioner (or automated system) assigns 2 reviewers:
   - Must be coaches from opposite division
   - Cannot review own team's SOBs
7. System creates `sob_review` records
8. Reviewers notified via Discord DM and web app

**Phase 3: Review (Reviewers)**
9. Each reviewer independently reviews:
   - **Approve**: SOB is good as-is
   - **Amend**: Suggest changes (title, description, or points)
   - **Arbitrate**: Escalate to Commissioner

10. If both reviewers approve → SOB approved
11. If both reviewers amend → Apply amendments, then approve
12. If reviewers disagree → Commissioner arbitrates:
    - Commissioner reviews both suggestions
    - Commissioner makes final decision
    - Decision is binding

**Phase 4: Finalization**
13. System updates `sob_definition` status to `approved`
14. Coach notified of final SOBs
15. SOBs become active for tracking

**Outputs:**
- Each team has 3 approved SOBs
- SOB point values finalized
- Ready for season play

**Timeline:**
- Proposals due: 2 weeks before season start
- Reviews due: 1 week before season start
- Arbitration window: 3 days before season start

**Assistant Coach Interaction Example:**
```
Neve: "Alright, time to set some goals for the season! Let's create your SOBs.
       These are secret objectives that'll earn you bonus points.
       
       What's something you want the Gnorthmen to be known for this season?"

Coach: "I want to throw a lot of touchdown passes"

Neve: "Beauty! So you're going for a passing game, eh? Let's make that an SOB.
       How about: 'Gordie throws 3 touchdown passes in a single game'
       
       That's pretty tough, so I'm thinking... 32 points? Sound fair?"

Coach: "Yeah that works"

Neve: "Perfect! That's SOB #1 in the books. Two more to go..."
```

---

### 4.2 Ongoing Workflows

#### 4.2.1 Pre-Game Workflow (72hr, 24hr, 2hr Reminders)

**Trigger:** Match scheduled in system

**Actors:** AI Assistant Coach (both teams), Commissioner

**Timeline:**

**T-72hrs (3 days before):**
1. AI assistants DM both coaches:
   - Match details (opponent, date, time, location)
   - Request attendance confirmation
   - Reminder to prepare roster
2. Coaches respond with `/confirm` or `/cannot-make-it`
3. If `/cannot-make-it`:
   - AI prompts: "Want to post a Guest Coach Bounty?"
   - If yes → Trigger Bounty Workflow (4.3.1)
   - If no → Log attendance issue
4. System tracks confirmations

**T-24hrs (1 day before):**
5. AI assistants follow up with unconfirmed coaches
6. If still no response → Flag to Commissioner
7. AI prompts confirmed coaches for roster submission:
   - Starting 11 players
   - Inducements (if any)
   - Special notes (injuries, missing players)
8. Coaches submit via conversation with AI
9. System validates roster against current team state

**T-2hrs (2 hours before):**
10. Final reminder to both coaches
11. If either coach unconfirmed → Auto-post Bounty (if not already)
12. AI reminds coaches of location/time
13. Weather roll (if using weather rules):
    - System rolls weather
    - AI announces to both coaches
    - Logged in `match_reports`

**No-Show Handling:**
14. If coach no-call-no-show at game time:
    - System changes match status to `bounty_posted`
    - Posts bounty to league channel
    - Commissioner notified
    - Opponent notified (can stick around or leave)

**Outputs:**
- Attendance confirmed (or bounty posted)
- Rosters submitted
- Weather determined
- Both coaches prepared

**Assistant Coach Interaction Example (T-72hrs):**
```
Neve: "Hey bud! Quick heads up - you've got a game against the Bloodfang Bruisers 
       in 3 days (Friday, Nov 15 at 7pm, Steve's place).
       
       Can you make it? Just need a quick confirmation!"

Coach: "Yeah I'll be there"

Neve: "Beauty! Marked you down. I'll check in about the roster tomorrow, eh?"
```

**Assistant Coach Interaction Example (T-24hrs):**
```
Neve: "Alright, game's tomorrow! Let's lock in your starting lineup.
       
       Here's your current roster:
       - Gordie Gnomehands (Catcher) - Active
       - Shoresy McStabbins (Blitzer) - Active
       - Timbits Thunderfoot (Lineman) - INJURED (miss next game)
       ...
       
       Timbits is out, so we need to adjust. Who's starting?"

Coach: "Take Timbits out, put in Maple as backup lineman"

Neve: "Got it! Maple's in. Anyone else need changing? Any inducements you want?"

Coach: "Nah we're good"

Neve: "Perfect! Roster's locked. See you tomorrow, and good luck out there!"
```

---

#### 4.2.2 Post-Game Reporting Workflow

**Trigger:** Match completed

**Actors:** Coach (or Guest Coach), AI Assistant Coach

**Steps:**

**Phase 1: Initial Report**
1. AI assistant initiates post-game sequence via DM:
   - Congratulates/commiserates on result
   - Asks for final score
2. Coach provides score
3. System validates score format (e.g., "3-1" or "3 to 1")
4. AI confirms: "So you won 3-1, that right?"
5. Coach confirms

**Phase 2: Scoring Details**
6. AI asks: "Who scored your touchdowns?"
7. Coach lists players
8. System validates players exist on roster
9. For each TD, AI asks: "Was that a pass or rush?"
10. If pass: "Who threw it?"
11. Coach provides thrower name
12. System validates and logs:
    - Touchdown: +3 SPP to scorer
    - Completion: +1 SPP to thrower

**Phase 3: Other Events**
13. AI asks: "Any casualties?"
14. If yes:
    - "Who got hurt?"
    - "What was the injury roll?"
    - "Did you use your apothecary?"
15. System logs casualties (+2 SPP to inflictor if applicable)
16. AI asks: "Any interceptions?"
17. If yes: Log interception (+3 SPP)

**Phase 4: MVP Selection**
18. AI presents eligible players:
    - Must have played
    - Cannot be dead (15-16 result)
19. Coach selects MVP
20. System awards +4 SPP to MVP
21. AI asks: "Want to write up why [player] earned MVP?"
22. If yes:
    - Coach writes short story
    - System creates `player_of_week_submission`
23. If no: Skip to next step

**Phase 5: Calculate & Update**
24. System calculates total SPP for each player
25. System checks for advancements (players at 6, 16, 31, 51, 76, 176 SPP)
26. If advancements available:
    - AI notifies coach
    - Triggers Advancement Workflow (4.2.5)
27. System updates:
    - Player stats in `players` table
    - Team record in `teams` table
    - Match result in `matches` table
28. System checks for injuries:
    - Niggling injuries
    - Stat reductions
    - Deaths
29. AI confirms injuries with coach

**Phase 6: Treasury & Inducements**
30. System calculates winnings:
    - Base: (1d6 × 10,000) × TV modifier
    - Gate receipts based on dedicated fans
    - Win bonus if applicable
31. AI announces winnings
32. System updates team treasury

**Phase 7: SOB Achievements**
33. AI asks: "Did you complete any SOBs this game?"
34. Coach lists SOBs achieved (by player)
35. System validates against `sob_definitions`
36. System calculates converted SOBs using formula:
    ```
    SOB = log(team_tier) + 2 × (points / 10)
    ```
37. System creates `sob_achievements` records
38. AI congratulates on SOBs

**Phase 8: Finalization**
39. AI summarizes entire report:
    - Final score
    - SPP awarded
    - Injuries
    - Treasury changes
    - SOBs achieved
40. Coach confirms or requests corrections
41. System creates `match_report` record
42. System updates match status to `completed`
43. Opponent notified that report submitted

**Outputs:**
- Match report completed
- Player stats updated
- Team record updated
- SOBs logged
- Ready for next game

**Validation:**
- All player names valid
- SPP calculations correct
- Injury rules followed
- SOB achievements verified

**Assistant Coach Interaction Example:**
```
Neve: "Hey there! How'd the game go?"

Coach: "We won 3-1!"

Neve: "Oh that's just beautiful! Three to one - way to go!
       Who put the biscuit in the basket for us?"

Coach: "Gordie scored twice, Shoresy got one"

Neve: "Gordie with the double! Were those passes or rushes?"

Coach: "First one was a pass from Timbits, second was a rush. Shoresy rushed his"

Neve: "Perfect! So that's:
       - Timbits: +1 SPP (completion)
       - Gordie: +6 SPP (2 touchdowns)
       - Shoresy: +3 SPP (1 touchdown)
       
       Sound right?"

Coach: "Yep!"

Neve: "Beauty! Any casualties?"

Coach: "Yeah, Gordie smashed their blitzer. He's out for the game."

Neve: "Ooh, that's a good hit! +2 SPP for Gordie. Brings him to 8 total.
       
       Alright, time for MVP. Who gets it?"

Coach: "Gordie earned it"

Neve: "No argument there! That's another +4 SPP for Gordie.
       He's now at 12 SPP total.
       
       Want to write up why he deserves Player of the Week?"

Coach: "Nah I'm beat"

Neve: "Fair enough! You earned a rest after that win.
       
       Here's what we made today:
       - 50,000 gold from gate receipts
       - 30,000 gold win bonus
       - Total: 80,000 added to treasury
       
       Did you complete any SOBs this game?"

Coach: "Yeah! Gordie got two TDs in one game"

Neve: "Oh that's a beaut! Let me look that up...
       Found it: 'Gordie scores 2+ TDs in a single game' - 32 points
       
       With your Tier 3 team, that converts to 7 SOBs. Nice work!
       
       Alright, that's everything! Great game, eh?"
```

---

#### 4.2.3 Roster Management Workflow

**Trigger:** Coach wants to modify team roster

**Actors:** Coach, AI Assistant Coach

**Use Cases:**
- Add new players (free agents/journeymen)
- Fire players
- Adjust player numbers
- Buy team assets (rerolls, apothecary, etc.)

**Steps:**

**Adding Players:**
1. Coach initiates: "I want to hire a new player"
2. AI assistant checks:
   - Current roster size
   - Team treasury
   - Available positions for race
3. AI presents options:
   - Position types available
   - Cost for each
4. Coach selects position and provides name/number
5. System validates:
   - Number not already used
   - Sufficient funds
6. System creates `player` record
7. System deducts cost from treasury
8. AI confirms addition

**Firing Players:**
1. Coach initiates: "I want to fire [player]"
2. AI confirms: "Are you sure? This is permanent."
3. If confirmed:
   - System removes player from roster
   - No refund (lost value)
   - AI acknowledges: "Released [player] from the team"

**Buying Assets:**
1. Coach initiates: "I want to buy a reroll"
2. AI checks:
   - Team treasury
   - Asset cost (varies by race, timing)
3. If sufficient funds:
   - System deducts cost
   - Updates team record
4. AI confirms purchase

**Outputs:**
- Roster updated
- Treasury adjusted
- Changes logged in audit

**Validation:**
- Cannot exceed roster limits (typically 16 players)
- Cannot fire players to go below minimum (11)
- Sufficient funds for purchases

---

#### 4.2.4 Advancement Workflow

**Trigger:** Player reaches advancement threshold (6, 16, 31, 51, 76, 176 SPP)

**Actors:** Coach, AI Assistant Coach

**Steps:**
1. AI detects advancement during post-game or roster review
2. AI notifies coach: "[Player] has reached advancement! Time to level up!"
3. AI presents options based on player position:
   - **Normal skills** (cost: 1 advancement)
   - **Double skills** (cost: 2 advancements, or roll doubles)
   - **Stat increase** (roll 10+ on 2d6)
4. Coach decides:
   - Take skill from normal access
   - Take skill from double access (if eligible)
   - Attempt stat increase roll
5. If stat increase attempted:
   - System rolls 2d6
   - If 10+: Coach chooses stat to increase (within limits)
   - If <10: Must take skill instead
6. Coach selects specific skill or stat
7. System validates:
   - Skill not already possessed
   - Stat increase within race limits
8. System updates `player` record:
   - Adds skill to skills array
   - Or increases stat value
9. System recalculates player value
10. AI congratulates coach

**Outputs:**
- Player advanced
- Skills/stats updated
- Player value recalculated

**Validation:**
- Cannot take duplicate skills
- Stat increases capped per race
- Advancement properly consumed

**Assistant Coach Interaction Example:**
```
Neve: "Oh hey, big news! Gordie just hit 16 SPP - time to level up!
       
       He's got access to these skills normally:
       - Dodge
       - Block
       - Sure Hands
       - Catch (already has this)
       
       Or you can roll for a stat increase. Want to try your luck?"

Coach: "Let's go for the stat increase"

Neve: "Alright, here goes... *rolls dice* 
       
       8. Ah, not quite! Gotta take a skill instead.
       
       What'll it be?"

Coach: "Dodge"

Neve: "Dodge it is! Gordie's getting slippery out there. 
       His new value is 90,000. Congrats bud!"
```

---

#### 4.2.5 Weekly Player of the Week Voting

**Trigger:** End of game week

**Actors:** All Coaches, Commissioner

**Steps:**

**Phase 1: Submission Window (Ongoing)**
- Coaches submit Player of Week stories during post-game (optional)
- Stories accumulate in `player_of_week_submissions`

**Phase 2: Voting Opens (End of week)**
1. System compiles all submissions for the week
2. Commissioner (or automated) opens voting
3. AI assistants notify all coaches: "Time to vote for Player of the Week!"
4. Coaches view submissions via web app or Discord bot
5. Each coach gets votes equal to their dedicated fans count
6. Coaches cast votes (can split among multiple nominees)
7. Cannot vote for own players (system blocks)

**Phase 3: Voting Closes (7 days after opening)**
8. System tallies votes
9. System determines winner (highest vote count)
10. System updates `player_of_week_submissions.winner = true`
11. Winner's team receives +5 fan attendance at next home game
12. AI announces winner in league channel
13. Winner's coach notified via DM

**Outputs:**
- Player of Week determined
- Winning team gets fan boost
- Contributes to end-of-season "Chosen One" award

**Validation:**
- Cannot vote for own players
- Vote count matches dedicated fans
- One winner per week

---

### 4.3 Special Workflows

#### 4.3.1 Guest Coach Bounty Workflow

**Trigger:** Coach cannot attend scheduled match

**Actors:** Absent Coach, AI Assistant, Commissioner, Potential Guest Coaches

**Types of Bounties:**
- **No-show Bounty**: Posted by absent coach
- **Civil War Bounty**: Posted by Commissioner (both teams same owner)
- **Bonus Bounty**: Posted 3hrs before match if no takers

**Steps:**

**Phase 1: Bounty Posted**
1. Triggering event:
   - Coach declares unavailable (T-72hrs or T-24hrs)
   - Or no-call-no-show detected
   - Or civil war match scheduled
2. System creates `bounty` record:
   - Standard bounty: +1 reroll, 50k gold to absent team
   - Win bonus: 100k gold to guest coach's team
3. System creates `guest_coach_session` with status=`posted`
4. AI posts bounty to league channel:
   ```
   🚨 GUEST COACH BOUNTY 🚨
   Match: [Team A] vs [Team B]
   Date: [Date/Time]
   Location: [Location]
   
   Bounty Rewards:
   - [Team needing coach] gets +1 reroll & 50k gold
   - You get 100k gold if you win
   
   React with ⚔️ to claim!
   ```
5. Bounty expires at match time (or sooner if claimed)

**Phase 2: Bounty Claimed**
6. Eligible coach reacts or uses `/claim-bounty [match_id]`
7. System validates:
   - Claimant doesn't own either team
   - Claimant not already a guest for another active match
8. System updates `guest_coach_session`:
   - guest_user_id = claimant
   - status = `claimed`
   - claimed_at = now
9. System creates `match_participant` for guest coach
10. Guest coach granted temporary access to team roster (read-only for SOBs)
11. AI notifies:
    - Guest coach (roster details, match info)
    - Absent coach (their team is covered)
    - Opponent (who they're facing)

**Phase 3: Match Played**
12. Guest coach plays match using absent coach's team
13. Guest coach submits post-game report (follows 4.2.2)
14. System validates reporter is the guest coach

**Phase 4: Bounty Paid**
15. System awards:
    - Absent coach's team: +1 reroll, +50k treasury
    - If guest coach won: +100k to guest coach's team
16. System updates `guest_coach_session.status = completed`
17. Guest coach access expires (24hrs after match)
18. AI notifies all parties of rewards

**Bonus Bounty (No Takers):**
- If no claims by T-3hrs before match:
  - System updates bounty type to `bonus`
  - Additional 50k gold offered to guest coach
  - Match can be rescheduled before next game week
  - AI reposts with BONUS tag

**No Takers at All:**
- If still no claims at match time:
  - Absent coach takes forfeit loss (0 points)
  - Opponent gets 3 points (win) but no SPP/treasury
  - Absent coach's team doesn't advance post-game
  - Match status = `cancelled`

**Outputs:**
- Match gets played (or forfeited)
- Bounties distributed
- Attendance tracked

**Validation:**
- Guest coach eligible
- Bounty amounts calculated correctly
- Access expires properly

---

#### 4.3.2 Concession Review Workflow

**Trigger:** Coach concedes match

**Actors:** Conceding Coach, Opponent, Commissioner

**Steps:**
1. Coach declares concession:
   - Via Discord: `/concede`
   - Via web app: "Concede Match" button
2. System prompts: "Are you sure? This is an automatic loss."
3. Coach confirms
4. System immediately:
   - Takes photos of game state (coach responsibility)
   - Logs concession in `matches.conceded_by_team_id`
   - Sets match status = `conceded`
   - Marks match as `under_review = true`
5. Conceding coach completes their post-game sequence:
   - Player stats, injuries, treasury (as if they lost normally)
6. Opponent notified: "Opponent conceded. Match under review."
7. Commissioner reviews:
   - Game state photos
   - Circumstances of concession
   - Sportsmanship considerations
8. Commissioner decides opponent's rewards:
   - Full rewards (SPP, treasury, etc.)
   - Partial rewards
   - No rewards (unsportsmanlike concession)
9. Opponent completes post-game with adjusted rewards
10. Commissioner logs decision in audit
11. Match status = `completed`, `under_review = false`

**Outputs:**
- Concession recorded
- Conceding team gets loss
- Opponent gets reviewed rewards

**Validation:**
- Cannot concede after match completed
- Must document game state
- Commissioner review required

---

#### 4.3.3 Season End / Redraft Workflow

**Trigger:** Commissioner closes current season

**Actors:** Commissioner, All Coaches

**Steps:**

**Phase 1: Season Closure**
1. Commissioner verifies all matches complete
2. Commissioner calculates final standings:
   - League Champion (highest league points)
   - Division winners
3. Commissioner runs playoffs (if applicable):
   - Top 2 per division
   - Single elimination
   - Determines Season Winner
4. System calculates all end-of-season awards:
   - Player awards (Nuffle's Chosen, Chosen One, etc.)
   - Coach awards (Kindness, Inspiration, etc.)
5. Commissioner opens voting for subjective awards
6. Voting closes after 1 week
7. Commissioner announces all award winners
8. System logs awards in `awards` table
9. Commissioner sets season status = `closed`

**Phase 2: Redraft Lottery**
10. System calculates redraft entries:
    - Last place: 25 entries
    - 2nd last: 15 entries
    - 3rd last: 10 entries
    - Everyone: +1 entry per 20 SOBs
11. System runs lottery:
    - Draw #1 pick (gets 28 SPP player + 1 dedicated fan)
    - Draw #2 pick (gets 20 SPP player)
    - Draw #3 pick (gets 16 SPP player)
12. Winners notified

**Phase 3: New Season Initialization**
13. Commissioner creates new season
14. System prompts all coaches: "Bring team forward or start fresh?"
15. For coaches bringing teams forward:
    - Team data copied to new season
    - Treasury adjusted to salary cap
    - Players marked for new season
    - SOBs reset (must propose new ones)
16. For coaches starting fresh:
    - Old team archived
    - Create new team (follows 4.1.3)
17. Draft picks integrated:
    - Winners draft special players with SPP
    - Cost: journeyman salary
18. Commissioner sets new schedule (follows 4.1.4)
19. SOB proposal phase begins (follows 4.1.5)
20. Season status = `active`

**Outputs:**
- Season closed with awards finalized
- Teams carried forward or recreated
- New schedule ready
- Next season begins

---

### 4.4 Assistant Coach Interaction Patterns

#### 4.4.1 Deterministic Workflow Guidance

Every workflow has a deterministic sequence, but the AI wraps it in personality:

**Structure:**
```
Workflow Engine: "Need data point X in format Y"
    ↓
AI System Prompt: "You are [personality]. Ask for X in character. Format: Y"
    ↓
AI Response: [In-character request for data]
    ↓
Coach Input: [Response]
    ↓
Parse & Validate: Does input match format Y?
    ↓
If yes: Store X, advance to next step
If no: AI asks clarification in character
```

**Example - Post-Game TD Recording:**

**Deterministic Need:** Get list of players who scored touchdowns

**Neve's Ask:**
```
"Who put the biscuit in the basket for us? Just gimme the names, bud."
```

**Validation Logic:**
```python
def validate_touchdown_scorers(input_text, team_roster):
    # Extract player names from natural language
    names = extract_names(input_text)
    
    # Validate each name exists on roster
    valid_players = []
    invalid_names = []
    
    for name in names:
        player = fuzzy_match_player(name, team_roster)
        if player:
            valid_players.append(player)
        else:
            invalid_names.append(name)
    
    return valid_players, invalid_names
```

**If Valid:**
```
Neve: "Beauty! So that's Gordie with 2 and Shoresy with 1. Got it!"
[Stores: touchdowns = [("Gordie", 2), ("Shoresy", 1)]]
[Advances to next step: "Were those passes or rushes?"]
```

**If Invalid:**
```
Neve: "Hmm, I don't see 'Gord' on the roster. Did you mean Gordie Gnomehands?"
```

---

#### 4.4.2 Proactive Reminders

AI assistants can initiate conversations based on triggers:

**Triggers:**
- T-72hrs before match
- T-24hrs before match (roster due)
- Player reached advancement
- SOB deadline approaching
- Bounty posted for league

**Example - Advancement Notification:**
```
Neve: "Hey bud! Quick update - Gordie just hit 16 SPP after that last game.
       He's ready to level up! 
       
       Want to handle that now, or should I remind you later?"
```

**Example - Deadline Pressure (Strictness = High):**
```
Neve: "Okay look, I've been real patient here, but your roster's due in 2 hours
       and you still haven't confirmed your starting lineup.
       
       I need those names now, eh? Otherwise we're going with what we got."
```

---

#### 4.4.3 Personality Adaptation

Different assistants handle the same workflow differently:

**Scenario:** Coach hasn't confirmed attendance (T-24hrs)

**Neve (Canadian, Friendly):**
```
"Hey bud, just checking in... game's tomorrow and I haven't heard from ya.
 Everything okay? Can you still make it?"
```

**Grumnak (Orc, Grumpy):**
```
"Oi! Where ya been? Game's tomorrow and you ain't said nothin'.
 You showin' up or what? Don't make me post a bounty..."
```

**Pip (Halfling, Excitable):**
```
"Oh my gosh oh my gosh! The game's TOMORROW!!
 I haven't heard from you yet! Are you coming?! Please say yes! 🥺"
```

---

## 5. SYSTEM INTERFACES

### 5.1 Discord Bot

#### 5.1.1 Bot Architecture

**Bot Types:**
1. **League Bot** (1 per league)
   - Handles league-wide commands
   - Posts bounties, announcements
   - Manages schedule
   
2. **Assistant Coach Bots** (1 per team)
   - Personalized DM conversations
   - Workflow guidance
   - Reminders

**Communication Channels:**
- **League Channel** (public): Announcements, bounties, voting
- **Coach DMs** (private): Assistant coach conversations, sensitive data
- **Commissioner Channel** (private): Admin functions

#### 5.1.2 Core Commands

**League-Wide Commands** (used in server):
```
/schedule                    View full season schedule
/standings                   View current league standings
/awards                      View current award leaders
/bounties                    View active bounties
/claim-bounty [match_id]     Claim a guest coach bounty
/vote [award_type] [nominee] Vote for award
```

**Team Management Commands** (used in DMs with assistant):
```
/roster                View current roster
/stats [player]        View player stats
/team-info            View team details (treasury, fans, etc.)
/sobs                 View your team's SOBs
/schedule-my-games    View only your scheduled matches
```

**Match Commands** (used in DMs):
```
/confirm-attendance [match_id]   Confirm you'll be there
/submit-roster [match_id]        Submit starting lineup
/report-game [match_id]          Start post-game reporting
/concede [match_id]              Concede current match
```

**Commissioner Commands** (used in admin channel):
```
/admin schedule create           Open schedule creation wizard
/admin season open               Open new season
/admin season close              Close current season
/admin bounty post [match_id]    Manually post bounty
/admin override [match_id]       Override match result
/admin moderate-assistant [team] Flag assistant coach
```

#### 5.1.3 Conversational Interactions

Most interactions are **conversation-based** rather than slash commands.

**Example - Natural Language Post-Game:**
```
Coach: "We won!"
Neve: "Oh beauty! What was the score?"
Coach: "3-1"
Neve: "Nice! Who scored?"
Coach: "Gordie got 2, Shoresy got 1"
...
```

vs. rigid command:
```
/report-game match_id=abc123 score_home=3 score_away=1 
  touchdown_scorers="Gordie,Gordie,Shoresy"
```

**Implementation:**
- AI assistant parses natural language
- Extracts structured data via function calling
- Validates and stores
- Continues conversation

---

### 5.2 Web Application

#### 5.2.1 Key Pages/Views

**Public Pages:**
- **Landing Page**: What is BBLMS, features, join league
- **Login**: Discord OAuth

**Coach Pages** (mobile-first):
- **Dashboard**: Your next match, team summary, recent notifications
- **My Team**: Roster view, player stats, treasury
- **Schedule**: Your matches + full league schedule
- **Match Detail**: Upcoming or past match details
- **Standings**: League and division standings
- **Awards**: Current award leaders and voting
- **Submit Report**: Web-based post-game reporting (alternative to Discord)

**Commissioner Pages** (desktop-optimized):
- **Admin Dashboard**: League overview, pending actions
- **Season Setup Wizard**: Step-by-step season initialization
- **Schedule Creator**: Drag-and-drop match scheduling
- **SOB Review Dashboard**: Review pending SOBs
- **Bounty Management**: View/manage active bounties
- **Assistant Moderation**: Flag/disable problematic assistants
- **Reports**: Generate league statistics, exports

#### 5.2.2 Mobile-First Design Principles

**Key Features:**
- Responsive breakpoints (mobile: 0-768px, tablet: 768-1024px, desktop: 1024px+)
- Touch-friendly buttons (min 44px tap targets)
- Bottom navigation bar (fixed) on mobile
- Pull-to-refresh on list views
- Swipe gestures (e.g., swipe match card to concede)
- Progressive Web App (PWA) installable

**Dashboard Layout (Mobile):**
```
┌─────────────────────┐
│  [Avatar] Hi Coach! │
│                     │
│  ┌───────────────┐  │
│  │ NEXT MATCH    │  │
│  │ vs Team Name  │  │
│  │ Nov 15, 7pm   │  │
│  │ [Confirm]     │  │
│  └───────────────┘  │
│                     │
│  Your Team Summary  │
│  Treasury: 120k     │
│  Fans: 5            │
│  Record: 3-2-1      │
│                     │
│  Recent Activity    │
│  • Gordie advanced  │
│  • SOB achieved     │
│                     │
├─────────────────────┤
│ [Home][Team][More]  │
└─────────────────────┘
```

#### 5.2.3 Commissioner Wizards

**Season Setup Wizard** (desktop, multi-step):
```
Step 1: Basic Info
  - Season number
  - Start/end dates
  - Number of weeks

Step 2: Teams
  - Assign to divisions
  - Validate even split

Step 3: Generate Schedule
  - Auto-generate or manual
  - Set locations/times

Step 4: SOB Timeline
  - Set proposal deadline
  - Assign reviewers

Step 5: Review & Publish
  - Preview schedule
  - Notify coaches
  - Activate season
```

---

### 5.3 API Design

#### 5.3.1 RESTful API Endpoints

**Authentication:**
```
POST /auth/discord/callback   Discord OAuth callback
GET  /auth/me                 Get current user
POST /auth/logout             Logout
```

**Leagues:**
```
GET    /api/leagues/:id                Get league details
PATCH  /api/leagues/:id                Update league settings (commissioner only)
GET    /api/leagues/:id/standings      Get standings
GET    /api/leagues/:id/schedule       Get schedule
POST   /api/leagues/:id/seasons        Create new season
```

**Teams:**
```
GET    /api/teams/:id                  Get team details
PATCH  /api/teams/:id                  Update team (owner only)
GET    /api/teams/:id/players          Get roster
POST   /api/teams/:id/players          Add player
DELETE /api/teams/:id/players/:pid     Remove player
```

**Matches:**
```
GET    /api/matches/:id                Get match details
POST   /api/matches/:id/report         Submit match report
POST   /api/matches/:id/concede        Concede match
POST   /api/matches/:id/confirm        Confirm attendance
```

**Bounties:**
```
GET    /api/bounties                   List active bounties
POST   /api/bounties/:id/claim         Claim bounty
```

**SOBs:**
```
GET    /api/teams/:id/sobs             Get team's SOBs
POST   /api/teams/:id/sobs             Propose new SOBs
POST   /api/sobs/:id/review            Submit SOB review
```

**Awards:**
```
GET    /api/leagues/:id/awards         Get award standings
POST   /api/awards/:type/vote          Submit vote
```

#### 5.3.2 WebSocket Events

**Real-time Updates:**
```
bounty.posted        New bounty available
bounty.claimed       Bounty claimed by someone
match.reported       Match report submitted
match.confirmed      Coach confirmed attendance
award.voted          New vote cast
```

---

## 6. IMPLEMENTATION PHASES

### Phase 1: Core Foundation (Months 1-2)

**Goals:** Single-league MVP, deterministic workflows, web auth

**Deliverables:**
- Database schema implemented
- Discord OAuth authentication
- Basic web app (dashboard, team view, schedule)
- Discord bot with core commands (no AI yet)
- Manual workflows:
  - Coach registration
  - Team creation
  - Schedule creation
  - Basic post-game reporting

**Tech Stack:**
- Backend: Node.js + Express (or Python + FastAPI)
- Database: PostgreSQL
- Frontend: React + Tailwind CSS
- Discord: Discord.js (or discord.py)

**Success Criteria:**
- Can register 8 coaches
- Can create teams
- Can schedule matches
- Can report game results manually

---

### Phase 2: AI Assistant Coaches (Months 3-4)

**Goals:** Add personality layer, conversational workflows

**Deliverables:**
- AI assistant coach system
- Personality configuration UI
- Conversational post-game reporting
- Conversational pre-game reminders
- Token usage tracking
- Commissioner moderation tools

**Tech Stack:**
- LLM: Claude API (or OpenAI GPT-4)
- Discord: Enhanced with LLM integration
- Function calling for data extraction

**Success Criteria:**
- Each team has functional AI assistant
- Post-game reporting works conversationally
- Personality affects tone, not functionality
- Token usage stays within budget

---

### Phase 3: Advanced Workflows (Months 5-6)

**Goals:** SOBs, bounties, awards, mobile polish

**Deliverables:**
- SOB proposal & review system
- Guest coach bounty workflow
- Award calculations & voting
- Player of Week voting
- Mobile-optimized web interface
- PWA installation

**Success Criteria:**
- SOB system fully functional
- Bounties work end-to-end
- Awards calculated correctly
- Mobile experience excellent

---

### Phase 4: Polish & Scale (Months 7-8)

**Goals:** Season transitions, commissioner tools, documentation

**Deliverables:**
- Season open/close workflows
- Redraft lottery system
- Commissioner wizards (schedule, season setup)
- Audit log viewer
- Comprehensive documentation
- Deployment guide for other leagues

**Success Criteria:**
- Can transition between seasons
- Commissioners can manage league independently
- Documentation enables other leagues to install

---

## 7. TECHNICAL ARCHITECTURE

### 7.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    USERS                            │
│                                                     │
│  ┌──────────┐         ┌──────────┐                │
│  │ Discord  │         │ Web App  │                │
│  │  Client  │         │ (Mobile) │                │
│  └────┬─────┘         └────┬─────┘                │
│       │                    │                       │
└───────┼────────────────────┼───────────────────────┘
        │                    │
        │                    │
┌───────┼────────────────────┼───────────────────────┐
│       │     API LAYER      │                       │
│       │                    │                       │
│  ┌────▼─────┐         ┌───▼──────┐                │
│  │ Discord  │         │   REST   │                │
│  │   Bot    │◄───────►│   API    │                │
│  │          │         │          │                │
│  └────┬─────┘         └────┬─────┘                │
│       │                    │                       │
│       │     ┌──────────────┘                       │
│       │     │                                      │
│  ┌────▼─────▼─────┐                               │
│  │  Core Business  │                               │
│  │     Logic       │                               │
│  │                 │                               │
│  │  • Workflows    │                               │
│  │  • Validation   │                               │
│  │  • Calculations │                               │
│  └────┬──────┬─────┘                               │
│       │      │                                      │
└───────┼──────┼──────────────────────────────────────┘
        │      │
        │      └──────────┐
        │                 │
┌───────▼─────────────────▼─────────────────────────┐
│                EXTERNAL SERVICES                   │
│                                                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ Database │    │   LLM    │    │ Discord  │   │
│  │(Postgres)│    │   API    │    │   API    │   │
│  │          │    │ (Claude) │    │          │   │
│  └──────────┘    └──────────┘    └──────────┘   │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 7.2 Tech Stack Recommendations

**Backend:**
- **Framework:** Node.js + Express (or Python + FastAPI)
- **Database:** PostgreSQL 14+
- **ORM:** Prisma (Node) or SQLAlchemy (Python)
- **Cache:** Redis (for session management, rate limiting)

**Frontend:**
- **Framework:** React 18+
- **Styling:** Tailwind CSS
- **State:** React Query + Zustand
- **Build:** Vite

**Discord Integration:**
- **Library:** Discord.js (Node) or discord.py (Python)
- **Architecture:** Single bot with per-team DM contexts

**AI/LLM:**
- **Primary:** Claude API (Anthropic)
- **Alternative:** OpenAI GPT-4
- **Usage:** Function calling for structured data extraction

**Deployment:**
- **Hosting:** Railway, Render, or DigitalOcean
- **Database:** Managed PostgreSQL (same provider)
- **CDN:** Cloudflare (for static assets)
- **Monitoring:** Sentry (error tracking)

---

### 7.3 Data Flow Examples

#### Example 1: Post-Game Reporting via Discord

```
1. Coach: "We won 3-1"
   ↓
2. Discord Bot receives message
   ↓
3. Bot identifies context: Team X, Post-Game workflow
   ↓
4. Bot loads workflow state + team data from DB
   ↓
5. Bot constructs LLM prompt:
   - System: Neve's personality
   - Context: Post-game, need final score
   - Tools: validate_score() function
   ↓
6. LLM processes input → returns function call:
   validate_score(home_score=3, away_score=1)
   ↓
7. Bot validates data, stores in DB
   ↓
8. Bot advances workflow → next step (ask for scorers)
   ↓
9. LLM generates next prompt in Neve's voice
   ↓
10. Bot sends to Discord
```

#### Example 2: Pre-Game Reminder (Scheduled)

```
1. Cron job: Check matches in next 72 hours
   ↓
2. Query DB: Get unconfirmed matches
   ↓
3. For each match:
   - Load both teams' assistant configs
   - Check confirmation status
   ↓
4. If unconfirmed:
   - Generate reminder message via LLM (in personality)
   - Send DM via Discord API
   ↓
5. Log reminder sent in audit log
```

---

## 8. APPENDICES

### Appendix A: Blood Bowl Rules Summary

*(Simplified - full rules in official Games Workshop rulebook)*

**Core Concepts:**
- Turn-based tactical game (2 halves, 8 turns each)
- Each team tries to score touchdowns by getting ball to end zone
- Players have stats: Movement (MA), Strength (ST), Agility (AG), Armor Value (AV)
- Skills modify player abilities

**SPP (Star Player Points):**
- Touchdown: 3 SPP
- Completion: 1 SPP
- Casualty: 2 SPP
- Interception: 3 SPP
- MVP: 4 SPP

**Advancements:**
- 6 SPP: First advancement
- 16 SPP: Second
- 31 SPP: Third
- 51 SPP: Fourth
- 76 SPP: Fifth
- 176 SPP: Sixth

---

### Appendix B: SOB Formula Detailed

**Formula:**
```
SOB = log(team_tier) + 2 × (points / 10)
```
Rounded to nearest whole number.

**Example Calculations:**

| Team Tier | Points Value | Calculation | SOB Result |
|-----------|--------------|-------------|------------|
| Tier 1 | 64 | log(1) + 2×(64/10) = 0 + 12.8 = 12.8 | 13 |
| Tier 2 | 64 | log(2) + 2×(64/10) = 0.3 + 12.8 = 13.1 | 13 |
| Tier 3 | 64 | log(3) + 2×(64/10) = 0.48 + 12.8 = 13.28 | 13 |
| Tier 1 | 32 | log(1) + 2×(32/10) = 0 + 6.4 = 6.4 | 6 |
| Tier 3 | 32 | log(3) + 2×(32/10) = 0.48 + 6.4 = 6.88 | 7 |
| Tier 1 | 8 | log(1) + 2×(8/10) = 0 + 1.6 = 1.6 | 2 |
| Tier 3 | 8 | log(3) + 2×(8/10) = 0.48 + 1.6 = 2.08 | 2 |

**Tier Bonus:**
Lower tier teams get slightly higher SOB conversion, rewarding them for playing harder teams.

---

### Appendix C: Award Calculations

**Nuffle's Chosen (League MVP):**
- Player with most MVP awards (4 SPP each)
- Tiebreaker: Total SPP

**Chosen One (Fan Favourite):**
- Player with most Player of Week wins
- Tiebreaker: Total votes received

**Nuffle's Bolt (Offensive):**
- Highest combined SPP from Completions + Touchdowns
- Formula: (Completions × 1) + (Touchdowns × 3)

**Nuffle's Bulwark (Defensive):**
- Highest combined SPP from Interceptions + Casualties
- Formula: (Interceptions × 3) + (Casualties × 2)

**Nuffle's Wit:**
- Player with most SOBs achieved
- Tiebreaker: Highest single SOB point value

**Son/Daughter of Nuffle:**
- Coach whose team accumulated most total SOBs
- Includes league-wide SOBs (painted team, home field, etc.)

---

### Appendix D: League-Wide SOBs

These produce raw SOBs (not points), awarded automatically:

| Achievement | SOBs per Game |
|-------------|---------------|
| Fully painted roster (including coaches, cheerleaders, apothecary) | 1 |
| Fully painted team on field | 1 |
| Have a home field | 1 |
| Have a dugout for home team | 1 |
| Have a thematic dugout for home team | 1 |
| Have a thematic dugout for away team | 1 |
| Loan a superstar to league | 1 (per game used) |
| Loan a fully painted team to league | 1 (per game used) |
| Wear merch for current League team | 1 |
| Wear merch for former League team | 1 |

---

### Appendix E: Glossary

| Term | Definition |
|------|------------|
| **Blood Bowl** | Tabletop fantasy football game by Games Workshop |
| **Coach** | Human player who owns and manages a team |
| **Commissioner** | League administrator |
| **Guest Coach** | Temporary substitute for absent coach |
| **SOB** | Secret Objective Bonus - custom achievements |
| **Bounty** | Reward for guest coaching a match |
| **Civil War** | Match where one coach owns both teams |
| **SPP** | Star Player Points - experience for players |
| **Advancement** | Leveling up a player (gain skill or stat) |
| **Inducements** | Mercenaries/extras purchased for a match |
| **Concession** | Voluntary surrender before match ends |
| **Dedicated Fans** | Persistent fan count (affects gate receipts) |
| **Team Value** | Total worth of team (players + assets) |
| **Journeyman** | Free agent/rookie player |
| **Tier** | Power ranking of race (Tier 1 = strongest) |

---

## END OF DOCUMENT

**Document Version:** 1.0  
**Last Updated:** November 5, 2025  
**Author:** Claude (with Steve)  
**Status:** Draft for Implementation

**Next Steps:**
1. Review this document with stakeholders
2. Validate data model against edge cases
3. Prioritize features for Phase 1
4. Select tech stack
5. Begin database schema implementation
