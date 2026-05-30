export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bcra_tasas: {
        Row: {
          anio: number
          created_at: string
          id: string
          mes: string
          tna: number
        }
        Insert: {
          anio: number
          created_at?: string
          id?: string
          mes: string
          tna: number
        }
        Update: {
          anio?: number
          created_at?: string
          id?: string
          mes?: string
          tna?: number
        }
        Relationships: []
      }
      cobros_pagos: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_user_id: string | null
          ejecutado_id: string
          estado: string
          estudio_id: string
          fecha: string
          id: string
          monto: number
          nota: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          ejecutado_id: string
          estado?: string
          estudio_id: string
          fecha?: string
          id?: string
          monto?: number
          nota?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          ejecutado_id?: string
          estado?: string
          estudio_id?: string
          fecha?: string
          id?: string
          monto?: number
          nota?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobros_pagos_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "cobros_totals"
            referencedColumns: ["ejecutado_id"]
          },
          {
            foreignKeyName: "cobros_pagos_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "ejecutados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_pagos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      ejecutado_eventos: {
        Row: {
          aplicado: boolean
          confidence: number
          created_at: string
          ejecutado_id: string
          estudio_id: string
          id: string
          mail_id: string | null
          source: string
          tipo_evento: string
        }
        Insert: {
          aplicado?: boolean
          confidence?: number
          created_at?: string
          ejecutado_id: string
          estudio_id: string
          id?: string
          mail_id?: string | null
          source?: string
          tipo_evento: string
        }
        Update: {
          aplicado?: boolean
          confidence?: number
          created_at?: string
          ejecutado_id?: string
          estudio_id?: string
          id?: string
          mail_id?: string | null
          source?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "ejecutado_eventos_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "cobros_totals"
            referencedColumns: ["ejecutado_id"]
          },
          {
            foreignKeyName: "ejecutado_eventos_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "ejecutados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ejecutado_eventos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ejecutado_eventos_mail_id_fkey"
            columns: ["mail_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      ejecutados: {
        Row: {
          archived_at: string | null
          codemandados: string[]
          created_at: string
          created_by_user_id: string | null
          departamento: string
          deuda_inicial: number
          dinero_en_cuenta: number | null
          documento: string
          domicilio: string
          empresa: string | null
          estudio_id: string
          fecha_deuda: string | null
          fecha_mora: string | null
          gastos: number
          id: string
          is_draft: boolean
          juzgado: string
          medida_cautelar: string | null
          medida_cautelar_diligenciada: boolean
          medida_cautelar_estado: string | null
          medida_cautelar_nota: string
          movimiento: string | null
          movimiento_diligenciada: boolean | null
          nombre: string
          numero_expediente: string
          observaciones: string
          practica_liquidacion: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          codemandados?: string[]
          created_at?: string
          created_by_user_id?: string | null
          departamento?: string
          deuda_inicial?: number
          dinero_en_cuenta?: number | null
          documento?: string
          domicilio?: string
          empresa?: string | null
          estudio_id: string
          fecha_deuda?: string | null
          fecha_mora?: string | null
          gastos?: number
          id?: string
          is_draft?: boolean
          juzgado?: string
          medida_cautelar?: string | null
          medida_cautelar_diligenciada?: boolean
          medida_cautelar_estado?: string | null
          medida_cautelar_nota?: string
          movimiento?: string | null
          movimiento_diligenciada?: boolean | null
          nombre: string
          numero_expediente?: string
          observaciones?: string
          practica_liquidacion?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          codemandados?: string[]
          created_at?: string
          created_by_user_id?: string | null
          departamento?: string
          deuda_inicial?: number
          dinero_en_cuenta?: number | null
          documento?: string
          domicilio?: string
          empresa?: string | null
          estudio_id?: string
          fecha_deuda?: string | null
          fecha_mora?: string | null
          gastos?: number
          id?: string
          is_draft?: boolean
          juzgado?: string
          medida_cautelar?: string | null
          medida_cautelar_diligenciada?: boolean
          medida_cautelar_estado?: string | null
          medida_cautelar_nota?: string
          movimiento?: string | null
          movimiento_diligenciada?: boolean | null
          nombre?: string
          numero_expediente?: string
          observaciones?: string
          practica_liquidacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ejecutados_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          archived_at: string | null
          body_html: string
          body_text: string
          created_at: string
          ejecutado_id: string | null
          estudio_id: string
          from_email: string
          from_name: string
          gmail_connection_id: string | null
          gmail_labels: string[]
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          is_delegated: boolean
          match_confidence: number
          match_manual: boolean
          received_at: string | null
          snippet: string
          subject: string
          to_emails: string[]
        }
        Insert: {
          archived_at?: string | null
          body_html?: string
          body_text?: string
          created_at?: string
          ejecutado_id?: string | null
          estudio_id: string
          from_email?: string
          from_name?: string
          gmail_connection_id?: string | null
          gmail_labels?: string[]
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          is_delegated?: boolean
          match_confidence?: number
          match_manual?: boolean
          received_at?: string | null
          snippet?: string
          subject?: string
          to_emails?: string[]
        }
        Update: {
          archived_at?: string | null
          body_html?: string
          body_text?: string
          created_at?: string
          ejecutado_id?: string | null
          estudio_id?: string
          from_email?: string
          from_name?: string
          gmail_connection_id?: string | null
          gmail_labels?: string[]
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          is_delegated?: boolean
          match_confidence?: number
          match_manual?: boolean
          received_at?: string | null
          snippet?: string
          subject?: string
          to_emails?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "emails_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "cobros_totals"
            referencedColumns: ["ejecutado_id"]
          },
          {
            foreignKeyName: "emails_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "ejecutados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      escritos: {
        Row: {
          archived_at: string | null
          contenido: string
          created_at: string
          created_by_user_id: string | null
          ejecutado_id: string
          estudio_id: string
          id: string
          template_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          contenido?: string
          created_at?: string
          created_by_user_id?: string | null
          ejecutado_id: string
          estudio_id: string
          id?: string
          template_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          contenido?: string
          created_at?: string
          created_by_user_id?: string | null
          ejecutado_id?: string
          estudio_id?: string
          id?: string
          template_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escritos_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "cobros_totals"
            referencedColumns: ["ejecutado_id"]
          },
          {
            foreignKeyName: "escritos_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: false
            referencedRelation: "ejecutados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escritos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escritos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "escritos_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      escritos_templates: {
        Row: {
          archived_at: string | null
          categoria: string
          contenido: string
          created_at: string
          id: string
          orden: number
          sugerido_diligenciada: boolean | null
          sugerido_evento: string[]
          sugerido_medida_cautelar: string[]
          sugerido_movimiento: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          categoria?: string
          contenido?: string
          created_at?: string
          id?: string
          orden?: number
          sugerido_diligenciada?: boolean | null
          sugerido_evento?: string[]
          sugerido_medida_cautelar?: string[]
          sugerido_movimiento?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          categoria?: string
          contenido?: string
          created_at?: string
          id?: string
          orden?: number
          sugerido_diligenciada?: boolean | null
          sugerido_evento?: string[]
          sugerido_medida_cautelar?: string[]
          sugerido_movimiento?: string[]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      estudio_members: {
        Row: {
          estudio_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          estudio_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          estudio_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estudio_members_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      estudios: {
        Row: {
          created_at: string
          escritos_config: Json
          id: string
          nombre: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escritos_config?: Json
          id?: string
          nombre: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escritos_config?: Json
          id?: string
          nombre?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      facturas: {
        Row: {
          archived_at: string | null
          confirmada: boolean
          created_at: string
          created_by_user_id: string | null
          estudio_id: string
          fecha_generada: string
          id: string
          mensaje_generado: string
          pago_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          confirmada?: boolean
          created_at?: string
          created_by_user_id?: string | null
          estudio_id: string
          fecha_generada?: string
          id?: string
          mensaje_generado?: string
          pago_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          confirmada?: boolean
          created_at?: string
          created_by_user_id?: string | null
          estudio_id?: string
          fecha_generada?: string
          id?: string
          mensaje_generado?: string
          pago_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: true
            referencedRelation: "cobros_pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token: string | null
          archived_at: string | null
          connected_by_user_id: string | null
          created_at: string
          estudio_id: string
          google_email: string
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          refresh_token_encrypted: string
          scope: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          archived_at?: string | null
          connected_by_user_id?: string | null
          created_at?: string
          estudio_id: string
          google_email: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          refresh_token_encrypted: string
          scope?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          archived_at?: string | null
          connected_by_user_id?: string | null
          created_at?: string
          estudio_id?: string
          google_email?: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          refresh_token_encrypted?: string
          scope?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: true
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_oauth_states: {
        Row: {
          created_at: string
          created_by_user_id: string
          estudio_id: string
          expires_at: string
          redirect: string | null
          state: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          estudio_id: string
          expires_at: string
          redirect?: string | null
          state: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          estudio_id?: string
          expires_at?: string
          redirect?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_oauth_states_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_user_id: string | null
          ejecutado_id: string
          estudio_id: string
          id: string
          monto_total_jus: number
          observaciones: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          ejecutado_id: string
          estudio_id: string
          id?: string
          monto_total_jus?: number
          observaciones?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          ejecutado_id?: string
          estudio_id?: string
          id?: string
          monto_total_jus?: number
          observaciones?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: true
            referencedRelation: "cobros_totals"
            referencedColumns: ["ejecutado_id"]
          },
          {
            foreignKeyName: "honorarios_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: true
            referencedRelation: "ejecutados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios_pagos: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_user_id: string | null
          estudio_id: string
          fecha: string
          honorario_id: string
          id: string
          monto_ars: number
          monto_jus: number
          nota: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          estudio_id: string
          fecha?: string
          honorario_id: string
          id?: string
          monto_ars?: number
          monto_jus?: number
          nota?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          estudio_id?: string
          fecha?: string
          honorario_id?: string
          id?: string
          monto_ars?: number
          monto_jus?: number
          nota?: string
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_pagos_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_pagos_honorario_id_fkey"
            columns: ["honorario_id"]
            isOneToOne: false
            referencedRelation: "honorarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_pagos_honorario_id_fkey"
            columns: ["honorario_id"]
            isOneToOne: false
            referencedRelation: "honorarios_with_balance"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_profiles: {
        Row: {
          created_at: string
          cuit: string
          domicilio_electronico: string
          ibm: string
          iva_condicion: string
          legajo: string
          matricula: string
          nombre: string
          telefono: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cuit?: string
          domicilio_electronico?: string
          ibm?: string
          iva_condicion?: string
          legajo?: string
          matricula?: string
          nombre?: string
          telefono?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cuit?: string
          domicilio_electronico?: string
          ibm?: string
          iva_condicion?: string
          legajo?: string
          matricula?: string
          nombre?: string
          telefono?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      liquidaciones: {
        Row: {
          apellido_nombre: string
          archived_at: string | null
          capital: number
          created_at: string
          created_by_user_id: string | null
          cuenta: string
          ejecutado_id: string
          estudio_id: string
          fecha_desde: string
          fecha_hasta: string
          gastos: number
          id: string
          iva: number
          monto_adeudado: number
          total_intereses: number
          updated_at: string
        }
        Insert: {
          apellido_nombre?: string
          archived_at?: string | null
          capital?: number
          created_at?: string
          created_by_user_id?: string | null
          cuenta?: string
          ejecutado_id: string
          estudio_id: string
          fecha_desde: string
          fecha_hasta: string
          gastos?: number
          id?: string
          iva?: number
          monto_adeudado?: number
          total_intereses?: number
          updated_at?: string
        }
        Update: {
          apellido_nombre?: string
          archived_at?: string | null
          capital?: number
          created_at?: string
          created_by_user_id?: string | null
          cuenta?: string
          ejecutado_id?: string
          estudio_id?: string
          fecha_desde?: string
          fecha_hasta?: string
          gastos?: number
          id?: string
          iva?: number
          monto_adeudado?: number
          total_intereses?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: true
            referencedRelation: "cobros_totals"
            referencedColumns: ["ejecutado_id"]
          },
          {
            foreignKeyName: "liquidaciones_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: true
            referencedRelation: "ejecutados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidaciones_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      cobros_totals: {
        Row: {
          ejecutado_id: string | null
          estudio_id: string | null
          pagos_count: number | null
          total_proveido: number | null
          total_solicitado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ejecutados_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios_with_balance: {
        Row: {
          archived_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          ejecutado_id: string | null
          estudio_id: string | null
          id: string | null
          monto_total_jus: number | null
          observaciones: string | null
          pagado_jus: number | null
          pendiente_jus: number | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          ejecutado_id?: string | null
          estudio_id?: string | null
          id?: string | null
          monto_total_jus?: number | null
          observaciones?: string | null
          pagado_jus?: never
          pendiente_jus?: never
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          ejecutado_id?: string | null
          estudio_id?: string | null
          id?: string | null
          monto_total_jus?: number | null
          observaciones?: string | null
          pagado_jus?: never
          pendiente_jus?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: true
            referencedRelation: "cobros_totals"
            referencedColumns: ["ejecutado_id"]
          },
          {
            foreignKeyName: "honorarios_ejecutado_id_fkey"
            columns: ["ejecutado_id"]
            isOneToOne: true
            referencedRelation: "ejecutados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_estudio_id_fkey"
            columns: ["estudio_id"]
            isOneToOne: false
            referencedRelation: "estudios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_estudio_id: { Args: never; Returns: string }
      get_estudio_members: {
        Args: never
        Returns: {
          email: string
          joined_at: string
          nombre: string
          role: string
          user_id: string
        }[]
      }
      get_user_by_email: {
        Args: { p_email: string }
        Returns: {
          email: string
          id: string
        }[]
      }
      is_current_user_head: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
