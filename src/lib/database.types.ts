
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ambiguous_exercise_terms": {
                  Row: {
                    "exercise_id": string,"position": number,"term": string
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"position": number,"term": string
                  }
                  Update: {
                    "exercise_id"?: string,"position"?: number,"term"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ambiguous_exercise_terms_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": Database["public"]['Enums']["audit_action"],"actor_id": string | null,"at": string,"diff": NonNullable<Json>,"id": number,"org_id": string | null,"row_id": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["audit_action"],"actor_id"?: string | null,"at"?: string,"diff": NonNullable<Json>,"id"?: never,"org_id"?: string | null,"row_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["audit_action"],"actor_id"?: string | null,"at"?: string,"diff"?: NonNullable<Json>,"id"?: never,"org_id"?: string | null,"row_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"block_items": {
                  Row: {
                    "block_id": string,"exercise_id": string | null,"id": string,"implement_count": number | null,"load": Json | null,"load_effort": string | null,"notes": string,"org_id": string,"pace_effort": string | null,"position": number,"quantity": NonNullable<Json>,"raw_line": string,"slot": number | null,"station_label": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "block_id": string,"exercise_id"?: string | null,"id"?: string,"implement_count"?: number | null,"load"?: Json | null,"load_effort"?: string | null,"notes"?: string,"org_id": string,"pace_effort"?: string | null,"position": number,"quantity": NonNullable<Json>,"raw_line": string,"slot"?: number | null,"station_label"?: string | null
                  }
                  Update: {
                    "block_id"?: string,"exercise_id"?: string | null,"id"?: string,"implement_count"?: number | null,"load"?: Json | null,"load_effort"?: string | null,"notes"?: string,"org_id"?: string,"pace_effort"?: string | null,"position"?: number,"quantity"?: NonNullable<Json>,"raw_line"?: string,"slot"?: number | null,"station_label"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "block_items_block_same_gym"
      columns: ["block_id","org_id"]
isOneToOne: false
      referencedRelation: "blocks"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "block_items_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "block_items_load_effort_fkey"
      columns: ["load_effort"]
isOneToOne: false
      referencedRelation: "effort_levels"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "block_items_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "block_items_pace_effort_fkey"
      columns: ["pace_effort"]
isOneToOne: false
      referencedRelation: "effort_levels"
      referencedColumns: ["key"]
    }
                  ]
                },"block_results": {
                  Row: {
                    "block_id": string,"created_at": string,"deleted_at": string | null,"finish_high_s": number | null,"finish_low_s": number | null,"id": string,"logged_by": string | null,"note": string | null,"org_id": string,"rounds_high": number | null,"rounds_low": number | null,"session_label": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "block_id": string,"created_at"?: string,"deleted_at"?: string | null,"finish_high_s"?: number | null,"finish_low_s"?: number | null,"id"?: string,"logged_by"?: string | null,"note"?: string | null,"org_id": string,"rounds_high"?: number | null,"rounds_low"?: number | null,"session_label"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "block_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"finish_high_s"?: number | null,"finish_low_s"?: number | null,"id"?: string,"logged_by"?: string | null,"note"?: string | null,"org_id"?: string,"rounds_high"?: number | null,"rounds_low"?: number | null,"session_label"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "block_results_block_same_gym"
      columns: ["block_id","org_id"]
isOneToOne: false
      referencedRelation: "blocks"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "block_results_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "block_results_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "format": Database["public"]['Enums']["block_format"],"id": string,"intent": Database["public"]['Enums']["block_intent"],"label": string,"load_effort": string | null,"notes": string,"org_id": string,"pace_effort": string | null,"params": NonNullable<Json>,"partner": boolean,"position": number,"rest_after_s": number | null,"target_rounds": number | null,"title": string | null,"workout_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "format": Database["public"]['Enums']["block_format"],"id"?: string,"intent": Database["public"]['Enums']["block_intent"],"label": string,"load_effort"?: string | null,"notes"?: string,"org_id": string,"pace_effort"?: string | null,"params": NonNullable<Json>,"partner"?: boolean,"position": number,"rest_after_s"?: number | null,"target_rounds"?: number | null,"title"?: string | null,"workout_id": string
                  }
                  Update: {
                    "format"?: Database["public"]['Enums']["block_format"],"id"?: string,"intent"?: Database["public"]['Enums']["block_intent"],"label"?: string,"load_effort"?: string | null,"notes"?: string,"org_id"?: string,"pace_effort"?: string | null,"params"?: NonNullable<Json>,"partner"?: boolean,"position"?: number,"rest_after_s"?: number | null,"target_rounds"?: number | null,"title"?: string | null,"workout_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_load_effort_fkey"
      columns: ["load_effort"]
isOneToOne: false
      referencedRelation: "effort_levels"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "blocks_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_pace_effort_fkey"
      columns: ["pace_effort"]
isOneToOne: false
      referencedRelation: "effort_levels"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "blocks_workout_same_gym"
      columns: ["workout_id","org_id"]
isOneToOne: false
      referencedRelation: "workouts"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"effort_levels": {
                  Row: {
                    "key": string,"label_en": string,"position": number,"rir_max": number | null,"rir_min": number,"rpe_calc": number,"rpe_max": number,"rpe_min": number
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"label_en": string,"position": number,"rir_max"?: number | null,"rir_min": number,"rpe_calc": number,"rpe_max": number,"rpe_min": number
                  }
                  Update: {
                    "key"?: string,"label_en"?: string,"position"?: number,"rir_max"?: number | null,"rir_min"?: number,"rpe_calc"?: number,"rpe_max"?: number,"rpe_min"?: number
                  }
                  Relationships: [
                    
                  ]
                },"equipment": {
                  Row: {
                    "key": string,"label_en": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"label_en": string,"position": number
                  }
                  Update: {
                    "key"?: string,"label_en"?: string,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"exercise_aliases": {
                  Row: {
                    "alias_normalized": string,"created_at": string,"created_by": string | null,"exercise_id": string,"id": string,"org_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alias_normalized": string,"created_at"?: string,"created_by"?: string | null,"exercise_id": string,"id"?: string,"org_id"?: string | null
                  }
                  Update: {
                    "alias_normalized"?: string,"created_at"?: string,"created_by"?: string | null,"exercise_id"?: string,"id"?: string,"org_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_aliases_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_aliases_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_aliases_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_equipment": {
                  Row: {
                    "equipment_key": string,"exercise_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "equipment_key": string,"exercise_id": string
                  }
                  Update: {
                    "equipment_key"?: string,"exercise_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_equipment_equipment_key_fkey"
      columns: ["equipment_key"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "exercise_equipment_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_muscles": {
                  Row: {
                    "exercise_id": string,"muscle_key": string,"role": Database["public"]['Enums']["muscle_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"muscle_key": string,"role": Database["public"]['Enums']["muscle_role"]
                  }
                  Update: {
                    "exercise_id"?: string,"muscle_key"?: string,"role"?: Database["public"]['Enums']["muscle_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_muscles_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_muscles_muscle_key_fkey"
      columns: ["muscle_key"]
isOneToOne: false
      referencedRelation: "muscles"
      referencedColumns: ["key"]
    }
                  ]
                },"exercise_pace_overrides": {
                  Row: {
                    "exercise_id": string,"org_id": string,"pace": NonNullable<Json>,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"org_id": string,"pace": NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "exercise_id"?: string,"org_id"?: string,"pace"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_pace_overrides_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_pace_overrides_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_pace_overrides_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_patterns": {
                  Row: {
                    "exercise_id": string,"pattern_key": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"pattern_key": string,"weight": number
                  }
                  Update: {
                    "exercise_id"?: string,"pattern_key"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_patterns_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercise_patterns_pattern_key_fkey"
      columns: ["pattern_key"]
isOneToOne: false
      referencedRelation: "movement_patterns"
      referencedColumns: ["key"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "created_at": string,"created_by": string | null,"default_unit": Database["public"]['Enums']["measure_unit"],"deleted_at": string | null,"id": string,"implement_count": number,"kind": Database["public"]['Enums']["exercise_kind"],"modality": string | null,"name": string,"org_id": string | null,"pace_default": Json | null,"plane": string | null,"slug": string,"status": Database["public"]['Enums']["exercise_status"],"unilateral": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"default_unit": Database["public"]['Enums']["measure_unit"],"deleted_at"?: string | null,"id"?: string,"implement_count"?: number,"kind": Database["public"]['Enums']["exercise_kind"],"modality"?: string | null,"name": string,"org_id"?: string | null,"pace_default"?: Json | null,"plane"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["exercise_status"],"unilateral"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"default_unit"?: Database["public"]['Enums']["measure_unit"],"deleted_at"?: string | null,"id"?: string,"implement_count"?: number,"kind"?: Database["public"]['Enums']["exercise_kind"],"modality"?: string | null,"name"?: string,"org_id"?: string | null,"pace_default"?: Json | null,"plane"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["exercise_status"],"unilateral"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercises_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercises_modality_fkey"
      columns: ["modality"]
isOneToOne: false
      referencedRelation: "modalities"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "exercises_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exercises_plane_fkey"
      columns: ["plane"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["key"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"org_id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_id": string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["org_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"modalities": {
                  Row: {
                    "default_unit": Database["public"]['Enums']["measure_unit"],"key": string,"label_en": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "default_unit": Database["public"]['Enums']["measure_unit"],"key": string,"label_en": string,"position": number
                  }
                  Update: {
                    "default_unit"?: Database["public"]['Enums']["measure_unit"],"key"?: string,"label_en"?: string,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"movement_patterns": {
                  Row: {
                    "key": string,"label_en": string,"position": number,"region": Database["public"]['Enums']["body_region"]
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"label_en": string,"position": number,"region": Database["public"]['Enums']["body_region"]
                  }
                  Update: {
                    "key"?: string,"label_en"?: string,"position"?: number,"region"?: Database["public"]['Enums']["body_region"]
                  }
                  Relationships: [
                    
                  ]
                },"muscles": {
                  Row: {
                    "key": string,"label_en": string,"position": number,"region": Database["public"]['Enums']["body_region"]
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"label_en": string,"position": number,"region": Database["public"]['Enums']["body_region"]
                  }
                  Update: {
                    "key"?: string,"label_en"?: string,"position"?: number,"region"?: Database["public"]['Enums']["body_region"]
                  }
                  Relationships: [
                    
                  ]
                },"organizations": {
                  Row: {
                    "country": string | null,"created_at": string,"id": string,"name": string,"settings": NonNullable<Json>,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string | null,"created_at"?: string,"id"?: string,"name": string,"settings"?: NonNullable<Json>,"slug": string
                  }
                  Update: {
                    "country"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"settings"?: NonNullable<Json>,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"planes": {
                  Row: {
                    "key": string,"label_en": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"label_en": string,"position": number
                  }
                  Update: {
                    "key"?: string,"label_en"?: string,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"locale": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"locale"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string
                  }
                  Relationships: [
                    
                  ]
                },"taxonomy_versions": {
                  Row: {
                    "notes": string,"published_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "notes"?: string,"published_at": string,"version": number
                  }
                  Update: {
                    "notes"?: string,"published_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"tracks": {
                  Row: {
                    "archived_at": string | null,"color": string | null,"created_at": string,"id": string,"name": string,"org_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"id"?: string,"name": string,"org_id": string,"position"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tracks_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_metrics": {
                  Row: {
                    "calc_version": number,"computed_at": string,"confidence": NonNullable<Json>,"metrics": NonNullable<Json>,"org_id": string,"taxonomy_version": number,"workout_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calc_version": number,"computed_at"?: string,"confidence"?: NonNullable<Json>,"metrics": NonNullable<Json>,"org_id": string,"taxonomy_version": number,"workout_id": string
                  }
                  Update: {
                    "calc_version"?: number,"computed_at"?: string,"confidence"?: NonNullable<Json>,"metrics"?: NonNullable<Json>,"org_id"?: string,"taxonomy_version"?: number,"workout_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_metrics_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_metrics_taxonomy_version_fkey"
      columns: ["taxonomy_version"]
isOneToOne: false
      referencedRelation: "taxonomy_versions"
      referencedColumns: ["version"]
    },{
      foreignKeyName: "workout_metrics_workout_same_gym"
      columns: ["workout_id","org_id"]
isOneToOne: false
      referencedRelation: "workouts"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"workouts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"date": string | null,"deleted_at": string | null,"focus": string | null,"id": string,"kind": Database["public"]['Enums']["workout_kind"],"org_id": string,"parser_version": number | null,"raw_text": string | null,"status": Database["public"]['Enums']["workout_status"],"title": string | null,"track_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"date"?: string | null,"deleted_at"?: string | null,"focus"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["workout_kind"],"org_id": string,"parser_version"?: number | null,"raw_text"?: string | null,"status"?: Database["public"]['Enums']["workout_status"],"title"?: string | null,"track_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"date"?: string | null,"deleted_at"?: string | null,"focus"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["workout_kind"],"org_id"?: string,"parser_version"?: number | null,"raw_text"?: string | null,"status"?: Database["public"]['Enums']["workout_status"],"title"?: string | null,"track_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workouts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workouts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workouts_track_same_gym"
      columns: ["track_id","org_id"]
isOneToOne: false
      referencedRelation: "tracks"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "workouts_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"copy_workout":
{ Args: { "p_org": string,"p_source": string,"p_targets": Json }; Returns: number
                           },
"create_invitation":
{ Args: { "p_email": string,"p_org": string,"p_role": Database["public"]['Enums']["org_role"] }; Returns: string
                           },
"create_organization":
{ Args: { "p_country"?: string,"p_name": string,"p_slug": string }; Returns: string
                           },
"invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "email": string,"email_matches": boolean,"gym_name": string,"gym_slug": string,"role": Database["public"]['Enums']["org_role"],"status": string
            }[]
                           },
"list_gym_members":
{ Args: { "p_org": string }; Returns: {
              "display_name": string,"email": string,"joined_at": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
            }[]
                           },
"save_gym_exercise":
{ Args: { "p_exercise": Json,"p_org": string }; Returns: string
                           },
"save_pasted_workout":
{ Args: { "p_aliases"?: Json,"p_org": string,"p_workout": Json }; Returns: string
                           },
"save_workout":
{ Args: { "p_org": string,"p_workout": Json }; Returns: string
                           }
          }
          Enums: {
            "audit_action": "insert"|"update"|"delete","block_format": "sets"|"every"|"amrap"|"for_time"|"intervals"|"tabata","block_intent": "strength"|"conditioning"|"skill"|"mobility","body_region": "lower"|"upper"|"core"|"systemic","exercise_kind": "movement"|"monostructural","exercise_status": "active"|"needs_review"|"archived","measure_unit": "reps"|"distance_m"|"calories"|"time_s","muscle_role": "primary"|"secondary","org_role": "owner"|"head_coach"|"coach"|"viewer","workout_kind": "scheduled"|"template","workout_status": "draft"|"published"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "audit_action": ["insert", "update", "delete"],"block_format": ["sets", "every", "amrap", "for_time", "intervals", "tabata"],"block_intent": ["strength", "conditioning", "skill", "mobility"],"body_region": ["lower", "upper", "core", "systemic"],"exercise_kind": ["movement", "monostructural"],"exercise_status": ["active", "needs_review", "archived"],"measure_unit": ["reps", "distance_m", "calories", "time_s"],"muscle_role": ["primary", "secondary"],"org_role": ["owner", "head_coach", "coach", "viewer"],"workout_kind": ["scheduled", "template"],"workout_status": ["draft", "published"]
          }
        }
} as const
