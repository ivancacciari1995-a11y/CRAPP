export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      badge_social_voti: {
        Row: {
          categoria: string;
          created_at: string;
          id: string;
          match_id: string;
          updated_at: string;
          votante_id: string;
          votato_id: string;
          votato_nome: string;
        };
        Insert: {
          categoria: string;
          created_at?: string;
          id?: string;
          match_id: string;
          updated_at?: string;
          votante_id: string;
          votato_id: string;
          votato_nome: string;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          id?: string;
          match_id?: string;
          updated_at?: string;
          votante_id?: string;
          votato_id?: string;
          votato_nome?: string;
        };
        Relationships: [];
      };
      cacche_partita: {
        Row: {
          created_at: string;
          evento_id: string;
          giocatore_id: string;
          id: string;
          quantita: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          evento_id: string;
          giocatore_id: string;
          id?: string;
          quantita?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          evento_id?: string;
          giocatore_id?: string;
          id?: string;
          quantita?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      eventi: {
        Row: {
          aggiornato_il: string;
          avversario: string | null;
          casa: boolean | null;
          creato_da: string | null;
          creato_il: string;
          data: string;
          id: string;
          luogo: string;
          ora: string;
          tipo: string;
          titolo: string;
        };
        Insert: {
          aggiornato_il?: string;
          avversario?: string | null;
          casa?: boolean | null;
          creato_da?: string | null;
          creato_il?: string;
          data: string;
          id?: string;
          luogo: string;
          ora: string;
          tipo: string;
          titolo: string;
        };
        Update: {
          aggiornato_il?: string;
          avversario?: string | null;
          casa?: boolean | null;
          creato_da?: string | null;
          creato_il?: string;
          data?: string;
          id?: string;
          luogo?: string;
          ora?: string;
          tipo?: string;
          titolo?: string;
        };
        Relationships: [];
      };
      eventi_app: {
        Row: {
          aggiornato_il: string;
          campionato: boolean;
          casa: boolean;
          convocati: string[];
          creato_il: string;
          data: string;
          id: string;
          luogo: string;
          note: string;
          ora: string;
          pagelle_chiuse: boolean;
          tipo: string;
          titolo: string;
        };
        Insert: {
          aggiornato_il?: string;
          campionato?: boolean;
          casa?: boolean;
          convocati?: string[];
          creato_il?: string;
          data: string;
          id: string;
          luogo?: string;
          note?: string;
          ora?: string;
          pagelle_chiuse?: boolean;
          tipo: string;
          titolo: string;
        };
        Update: {
          aggiornato_il?: string;
          campionato?: boolean;
          casa?: boolean;
          convocati?: string[];
          creato_il?: string;
          data?: string;
          id?: string;
          luogo?: string;
          note?: string;
          ora?: string;
          pagelle_chiuse?: boolean;
          tipo?: string;
          titolo?: string;
        };
        Relationships: [];
      };
      giocatori: {
        Row: {
          aggiornato_il: string;
          auth_user_id: string | null;
          creato_il: string;
          foto: string | null;
          id: string;
          nascita: string;
          nome: string;
          numero: number;
          ruolo: string;
        };
        Insert: {
          aggiornato_il?: string;
          auth_user_id?: string | null;
          creato_il?: string;
          foto?: string | null;
          id?: string;
          nascita: string;
          nome: string;
          numero: number;
          ruolo: string;
        };
        Update: {
          aggiornato_il?: string;
          auth_user_id?: string | null;
          creato_il?: string;
          foto?: string | null;
          id?: string;
          nascita?: string;
          nome?: string;
          numero?: number;
          ruolo?: string;
        };
        Relationships: [];
      };
      giocatori_squadra: {
        Row: {
          aggiornato_il: string;
          attivo: boolean;
          auth_user_id: string | null;
          cognome: string;
          creato_il: string;
          email: string | null;
          id: string;
          nome: string;
          numero: number;
          ruolo: string;
        };
        Insert: {
          aggiornato_il?: string;
          attivo?: boolean;
          auth_user_id?: string | null;
          cognome: string;
          creato_il?: string;
          email?: string | null;
          id: string;
          nome: string;
          numero: number;
          ruolo: string;
        };
        Update: {
          aggiornato_il?: string;
          attivo?: boolean;
          auth_user_id?: string | null;
          cognome?: string;
          creato_il?: string;
          email?: string | null;
          id?: string;
          nome?: string;
          numero?: number;
          ruolo?: string;
        };
        Relationships: [];
      };
      mvp_voti: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          updated_at: string;
          votante_id: string;
          votato_id: string;
          votato_nome: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          updated_at?: string;
          votante_id: string;
          votato_id: string;
          votato_nome: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          updated_at?: string;
          votante_id?: string;
          votato_id?: string;
          votato_nome?: string;
        };
        Relationships: [];
      };
      pagelle_voti: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          updated_at: string;
          votante_id: string;
          votato_id: string;
          voto: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          updated_at?: string;
          votante_id: string;
          votato_id: string;
          voto: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          updated_at?: string;
          votante_id?: string;
          votato_id?: string;
          voto?: number;
        };
        Relationships: [];
      };
      presenze: {
        Row: {
          aggiornato_da: string | null;
          aggiornato_il: string;
          evento_id: string;
          giocatore_id: string;
          id: string;
          stato: string;
        };
        Insert: {
          aggiornato_da?: string | null;
          aggiornato_il?: string;
          evento_id: string;
          giocatore_id: string;
          id?: string;
          stato: string;
        };
        Update: {
          aggiornato_da?: string | null;
          aggiornato_il?: string;
          evento_id?: string;
          giocatore_id?: string;
          id?: string;
          stato?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presenze_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "eventi";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presenze_giocatore_id_fkey";
            columns: ["giocatore_id"];
            isOneToOne: false;
            referencedRelation: "giocatori";
            referencedColumns: ["id"];
          },
        ];
      };
      profili_giocatore: {
        Row: {
          aggiornato_il: string;
          certificato_path: string | null;
          certificato_scadenza: string | null;
          creato_il: string;
          data_nascita: string | null;
          documento_emissione: string | null;
          documento_fronte_path: string | null;
          documento_numero: string | null;
          documento_retro_path: string | null;
          documento_rilasciato_da: string | null;
          documento_scadenza: string | null;
          documento_tipo: string | null;
          email: string | null;
          foto_path: string | null;
          giocatore_id: string;
          indirizzo: string | null;
          luogo_nascita: string | null;
          telefono: string | null;
        };
        Insert: {
          aggiornato_il?: string;
          certificato_path?: string | null;
          certificato_scadenza?: string | null;
          creato_il?: string;
          data_nascita?: string | null;
          documento_emissione?: string | null;
          documento_fronte_path?: string | null;
          documento_numero?: string | null;
          documento_retro_path?: string | null;
          documento_rilasciato_da?: string | null;
          documento_scadenza?: string | null;
          documento_tipo?: string | null;
          email?: string | null;
          foto_path?: string | null;
          giocatore_id: string;
          indirizzo?: string | null;
          luogo_nascita?: string | null;
          telefono?: string | null;
        };
        Update: {
          aggiornato_il?: string;
          certificato_path?: string | null;
          certificato_scadenza?: string | null;
          creato_il?: string;
          data_nascita?: string | null;
          documento_emissione?: string | null;
          documento_fronte_path?: string | null;
          documento_numero?: string | null;
          documento_retro_path?: string | null;
          documento_rilasciato_da?: string | null;
          documento_scadenza?: string | null;
          documento_tipo?: string | null;
          email?: string | null;
          foto_path?: string | null;
          giocatore_id?: string;
          indirizzo?: string | null;
          luogo_nascita?: string | null;
          telefono?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profili_giocatore_giocatore_id_fkey";
            columns: ["giocatore_id"];
            isOneToOne: true;
            referencedRelation: "giocatori_squadra";
            referencedColumns: ["id"];
          },
        ];
      };
      promemoria_push: {
        Row: {
          creato_il: string;
          endpoint: string;
          id: string;
          testo: string;
          titolo: string;
        };
        Insert: {
          creato_il?: string;
          endpoint: string;
          id?: string;
          testo: string;
          titolo: string;
        };
        Update: {
          creato_il?: string;
          endpoint?: string;
          id?: string;
          testo?: string;
          titolo?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          giocatore_id: string;
          id: string;
          p256dh: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          giocatore_id: string;
          id?: string;
          p256dh: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          giocatore_id?: string;
          id?: string;
          p256dh?: string;
        };
        Relationships: [];
      };
      risposte_presenze: {
        Row: {
          aggiornato_il: string;
          evento_id: string;
          giocatore_id: string;
          risposto_il: string;
          stato: string;
        };
        Insert: {
          aggiornato_il?: string;
          evento_id: string;
          giocatore_id: string;
          risposto_il?: string;
          stato: string;
        };
        Update: {
          aggiornato_il?: string;
          evento_id?: string;
          giocatore_id?: string;
          risposto_il?: string;
          stato?: string;
        };
        Relationships: [];
      };
      scout_live: {
        Row: {
          aggiornato_il: string;
          evento_id: string;
          stato: Json;
        };
        Insert: {
          aggiornato_il?: string;
          evento_id: string;
          stato?: Json;
        };
        Update: {
          aggiornato_il?: string;
          evento_id?: string;
          stato?: Json;
        };
        Relationships: [];
      };
      scout_partite: {
        Row: {
          avversario: string;
          azioni: Json;
          casa: boolean;
          creato_il: string;
          data: string;
          evento_id: string | null;
          id: string;
          parziali: Json;
          set_loro: number;
          set_nostri: number;
        };
        Insert: {
          avversario: string;
          azioni?: Json;
          casa?: boolean;
          creato_il?: string;
          data: string;
          evento_id?: string | null;
          id: string;
          parziali?: Json;
          set_loro: number;
          set_nostri: number;
        };
        Update: {
          avversario?: string;
          azioni?: Json;
          casa?: boolean;
          creato_il?: string;
          data?: string;
          evento_id?: string | null;
          id?: string;
          parziali?: Json;
          set_loro?: number;
          set_nostri?: number;
        };
        Relationships: [];
      };
      scout_sessioni: {
        Row: {
          aggiornato_il: string;
          evento_id: string;
          giocatore_id: string;
          giocatore_nome: string;
        };
        Insert: {
          aggiornato_il?: string;
          evento_id: string;
          giocatore_id: string;
          giocatore_nome: string;
        };
        Update: {
          aggiornato_il?: string;
          evento_id?: string;
          giocatore_id?: string;
          giocatore_nome?: string;
        };
        Relationships: [];
      };
      turni_palloni: {
        Row: {
          aggiornato_da: string | null;
          aggiornato_il: string;
          evento_id: string;
          giocatore_id: string;
        };
        Insert: {
          aggiornato_da?: string | null;
          aggiornato_il?: string;
          evento_id: string;
          giocatore_id: string;
        };
        Update: {
          aggiornato_da?: string | null;
          aggiornato_il?: string;
          evento_id?: string;
          giocatore_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
