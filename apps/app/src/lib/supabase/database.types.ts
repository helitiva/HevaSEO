export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      affiliate_commission: {
        Row: {
          affiliate_id: string
          balance: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          balance?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          balance?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount: number
          id: string
          requested_at: string
          resolved_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          id?: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          id?: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          created_at: string
          customer_id: string | null
          id: string
          status: string
          tenant_id: string
          volume: number
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          status?: string
          tenant_id: string
          volume?: number
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          status?: string
          tenant_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          code: string
          created_at: string
          id: string
          joined_at: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          tenant_id: string
          tier: Database["public"]["Enums"]["affiliate_tier"]
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          joined_at?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          tenant_id: string
          tier?: Database["public"]["Enums"]["affiliate_tier"]
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          joined_at?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          tenant_id?: string
          tier?: Database["public"]["Enums"]["affiliate_tier"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_transitions: {
        Row: {
          by_role: Database["public"]["Enums"]["app_role"]
          from_state: Database["public"]["Enums"]["order_state"]
          to_state: Database["public"]["Enums"]["order_state"]
        }
        Insert: {
          by_role: Database["public"]["Enums"]["app_role"]
          from_state: Database["public"]["Enums"]["order_state"]
          to_state: Database["public"]["Enums"]["order_state"]
        }
        Update: {
          by_role?: Database["public"]["Enums"]["app_role"]
          from_state?: Database["public"]["Enums"]["order_state"]
          to_state?: Database["public"]["Enums"]["order_state"]
        }
        Relationships: []
      }
      assignment_rules: {
        Row: {
          created_at: string
          id: string
          mode: string
          pkg: string | null
          service: string
          target_staff_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode: string
          pkg?: string | null
          service: string
          target_staff_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          pkg?: string | null
          service?: string
          target_staff_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_target_staff_id_fkey"
            columns: ["target_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          meta: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          meta?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          meta?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_events: {
        Row: {
          broadcast_id: string
          created_at: string
          id: string
          kind: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          id?: string
          kind: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          id?: string
          kind?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_events_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          audiences: string[]
          body: string | null
          created_at: string
          created_by_id: string | null
          id: string
          kind: Database["public"]["Enums"]["broadcast_kind"]
          scheduled_at: string | null
          status: Database["public"]["Enums"]["broadcast_status"]
          tenant_id: string
          title: string
        }
        Insert: {
          audiences?: string[]
          body?: string | null
          created_at?: string
          created_by_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["broadcast_kind"]
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          tenant_id: string
          title: string
        }
        Update: {
          audiences?: string[]
          body?: string | null
          created_at?: string
          created_by_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["broadcast_kind"]
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_packages: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          service_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          service_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "catalog_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_services: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_ledger: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          kind: string
          referral_id: string | null
          tenant_id: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          kind: string
          referral_id?: string | null
          tenant_id: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          referral_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          kind: string
          order_id: string | null
          stripe_event_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          kind: string
          order_id?: string | null
          stripe_event_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          kind?: string
          order_id?: string | null
          stripe_event_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_mgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_balances: {
        Row: {
          balance: number
          customer_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          customer_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          customer_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing: Json | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          last_active_at: string | null
          member_since: string | null
          name: string
          phone: string | null
          referrer_id: string | null
          status: Database["public"]["Enums"]["customer_status"]
          tags: string[]
          tenant_id: string
          tier: Database["public"]["Enums"]["customer_tier"]
          timezone: string | null
          user_id: string | null
        }
        Insert: {
          billing?: Json | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_active_at?: string | null
          member_since?: string | null
          name: string
          phone?: string | null
          referrer_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          tags?: string[]
          tenant_id: string
          tier?: Database["public"]["Enums"]["customer_tier"]
          timezone?: string | null
          user_id?: string | null
        }
        Update: {
          billing?: Json | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_active_at?: string | null
          member_since?: string | null
          name?: string
          phone?: string | null
          referrer_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          tags?: string[]
          tenant_id?: string
          tier?: Database["public"]["Enums"]["customer_tier"]
          timezone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          files: Json
          id: string
          order_id: string
          review_note: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["deliverable_status"]
          submitted_at: string
          submitter_id: string
          summary: string | null
          task_id: string | null
          tenant_id: string
          version: number
        }
        Insert: {
          files?: Json
          id?: string
          order_id: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          submitted_at?: string
          submitter_id: string
          summary?: string | null
          task_id?: string | null
          tenant_id: string
          version?: number
        }
        Update: {
          files?: Json
          id?: string
          order_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          submitted_at?: string
          submitter_id?: string
          summary?: string | null
          task_id?: string | null
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_mgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      docs: {
        Row: {
          audiences: string[]
          author_id: string | null
          body: Json
          created_at: string
          id: string
          pinned: boolean
          required_skills: string[]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audiences?: string[]
          author_id?: string | null
          body?: Json
          created_at?: string
          id?: string
          pinned?: boolean
          required_skills?: string[]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audiences?: string[]
          author_id?: string | null
          body?: Json
          created_at?: string
          id?: string
          pinned?: boolean
          required_skills?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "docs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "docs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          number: string
          provider: string
          provider_ref: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          number: string
          provider?: string
          provider_ref?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          number?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          from_date: string
          id: string
          reason: string | null
          staff_id: string
          status: string
          tenant_id: string
          to_date: string
        }
        Insert: {
          created_at?: string
          from_date: string
          id?: string
          reason?: string | null
          staff_id: string
          status?: string
          tenant_id: string
          to_date: string
        }
        Update: {
          created_at?: string
          from_date?: string
          id?: string
          reason?: string | null
          staff_id?: string
          status?: string
          tenant_id?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      note_attachments: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string | null
          note_id: string
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name?: string | null
          note_id: string
          tenant_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string | null
          note_id?: string
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: Json
          color: string | null
          created_at: string
          id: string
          owner_id: string
          surface: string
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: Json
          color?: string | null
          created_at?: string
          id?: string
          owner_id: string
          surface: string
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: Json
          color?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          surface?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read: boolean
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read?: boolean
          tenant_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addons: {
        Row: {
          created_at: string
          id: string
          name: string
          order_id: string
          price: number
          tenant_id: string
          tier: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_id: string
          price?: number
          tenant_id: string
          tier?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_id?: string
          price?: number
          tenant_id?: string
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_addons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_mgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_details: {
        Row: {
          brief: Json
          created_at: string
          folder: string | null
          id: string
          included: string[]
          order_id: string
          project: string | null
          tenant_id: string
        }
        Insert: {
          brief?: Json
          created_at?: string
          folder?: string | null
          id?: string
          included?: string[]
          order_id: string
          project?: string | null
          tenant_id: string
        }
        Update: {
          brief?: Json
          created_at?: string
          folder?: string | null
          id?: string
          included?: string[]
          order_id?: string
          project?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_mgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_details_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assignee_id: string | null
          checkout_ref: string | null
          code: string
          created_at: string
          customer_id: string
          deadline: string | null
          id: string
          pkg: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          service: string
          source: Database["public"]["Enums"]["order_source"]
          state: Database["public"]["Enums"]["order_state"]
          tenant_id: string
          value: number
        }
        Insert: {
          assignee_id?: string | null
          checkout_ref?: string | null
          code: string
          created_at?: string
          customer_id: string
          deadline?: string | null
          id?: string
          pkg?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          service: string
          source?: Database["public"]["Enums"]["order_source"]
          state?: Database["public"]["Enums"]["order_state"]
          tenant_id: string
          value?: number
        }
        Update: {
          assignee_id?: string | null
          checkout_ref?: string | null
          code?: string
          created_at?: string
          customer_id?: string
          deadline?: string | null
          id?: string
          pkg?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          service?: string
          source?: Database["public"]["Enums"]["order_source"]
          state?: Database["public"]["Enums"]["order_state"]
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          id: string
          method_id: string | null
          requested_at: string
          resolved_at: string | null
          staff_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          id?: string
          method_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          staff_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          id?: string
          method_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          staff_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "staff_payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          last_active_at: string | null
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tenant_id: string
          two_fa_enabled: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_active_at?: string | null
          name?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id: string
          two_fa_enabled?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_active_at?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string
          two_fa_enabled?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          customer_id: string
          folder_id: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          folder_id?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          folder_id?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_details: {
        Row: {
          active: boolean
          capacity: number
          composite: number
          created_at: string
          id: string
          manager_id: string | null
          on_time: number
          profile_id: string
          quality: number
          role_label: string | null
          since: string | null
          skills: string[]
          tenant_id: string
          throughput: number
          timezone: string | null
          trend: number[]
        }
        Insert: {
          active?: boolean
          capacity?: number
          composite?: number
          created_at?: string
          id?: string
          manager_id?: string | null
          on_time?: number
          profile_id: string
          quality?: number
          role_label?: string | null
          since?: string | null
          skills?: string[]
          tenant_id: string
          throughput?: number
          timezone?: string | null
          trend?: number[]
        }
        Update: {
          active?: boolean
          capacity?: number
          composite?: number
          created_at?: string
          id?: string
          manager_id?: string | null
          on_time?: number
          profile_id?: string
          quality?: number
          role_label?: string | null
          since?: string | null
          skills?: string[]
          tenant_id?: string
          throughput?: number
          timezone?: string | null
          trend?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "staff_details_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_details_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payout_methods: {
        Row: {
          created_at: string
          detail: string
          id: string
          is_default: boolean
          kind: string
          staff_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          detail: string
          id?: string
          is_default?: boolean
          kind: string
          staff_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          is_default?: boolean
          kind?: string
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payout_methods_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payout_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_wallet: {
        Row: {
          balance: number
          staff_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          staff_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          staff_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_wallet_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_wallet_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          brief: string | null
          created_at: string
          deadline: string | null
          id: string
          order_id: string
          priority: Database["public"]["Enums"]["order_priority"]
          state: Database["public"]["Enums"]["task_state"]
          tenant_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          brief?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          order_id: string
          priority?: Database["public"]["Enums"]["order_priority"]
          state?: Database["public"]["Enums"]["task_state"]
          tenant_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          brief?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          order_id?: string
          priority?: Database["public"]["Enums"]["order_priority"]
          state?: Database["public"]["Enums"]["task_state"]
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_mgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          name: string
          theme: Json
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          name: string
          theme?: Json
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
          theme?: Json
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          author_role: string
          body: string
          created_at: string
          id: string
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          author_role: string
          body: string
          created_at?: string
          id?: string
          tenant_id: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          code: string
          created_at: string
          customer_id: string | null
          id: string
          last_reply_at: string | null
          order_id: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          sla_tier: Database["public"]["Enums"]["sla_tier"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          type: Database["public"]["Enums"]["ticket_type"]
        }
        Insert: {
          assignee_id?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          code: string
          created_at?: string
          customer_id?: string | null
          id?: string
          last_reply_at?: string | null
          order_id?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          sla_tier?: Database["public"]["Enums"]["sla_tier"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          type: Database["public"]["Enums"]["ticket_type"]
        }
        Update: {
          assignee_id?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          code?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          last_reply_at?: string | null
          order_id?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          sla_tier?: Database["public"]["Enums"]["sla_tier"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["ticket_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_mgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          staff_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          staff_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_mgr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      orders_mgr: {
        Row: {
          assignee_id: string | null
          code: string | null
          created_at: string | null
          customer_id: string | null
          deadline: string | null
          id: string | null
          pkg: string | null
          priority: Database["public"]["Enums"]["order_priority"] | null
          service: string | null
          source: Database["public"]["Enums"]["order_source"] | null
          state: Database["public"]["Enums"]["order_state"] | null
          tenant_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          code?: string | null
          created_at?: string | null
          customer_id?: string | null
          deadline?: string | null
          id?: string | null
          pkg?: string | null
          priority?: Database["public"]["Enums"]["order_priority"] | null
          service?: string | null
          source?: Database["public"]["Enums"]["order_source"] | null
          state?: Database["public"]["Enums"]["order_state"] | null
          tenant_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          code?: string | null
          created_at?: string | null
          customer_id?: string | null
          deadline?: string | null
          id?: string | null
          pkg?: string | null
          priority?: Database["public"]["Enums"]["order_priority"] | null
          service?: string | null
          source?: Database["public"]["Enums"]["order_source"] | null
          state?: Database["public"]["Enums"]["order_state"] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      advance_order: {
        Args: {
          p_order: string
          p_to: Database["public"]["Enums"]["order_state"]
        }
        Returns: {
          assignee_id: string | null
          checkout_ref: string | null
          code: string
          created_at: string
          customer_id: string
          deadline: string | null
          id: string
          pkg: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          service: string
          source: Database["public"]["Enums"]["order_source"]
          state: Database["public"]["Enums"]["order_state"]
          tenant_id: string
          value: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_fee_pct: { Args: never; Returns: number }
      cancel_order: {
        Args: { p_order: string }
        Returns: {
          assignee_id: string | null
          checkout_ref: string | null
          code: string
          created_at: string
          customer_id: string
          deadline: string | null
          id: string
          pkg: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          service: string
          source: Database["public"]["Enums"]["order_source"]
          state: Database["public"]["Enums"]["order_state"]
          tenant_id: string
          value: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      create_order: {
        Args: {
          p_actor: string
          p_code: string
          p_customer: string
          p_service: string
          p_tenant: string
          p_value: number
        }
        Returns: {
          assignee_id: string | null
          checkout_ref: string | null
          code: string
          created_at: string
          customer_id: string
          deadline: string | null
          id: string
          pkg: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          service: string
          source: Database["public"]["Enums"]["order_source"]
          state: Database["public"]["Enums"]["order_state"]
          tenant_id: string
          value: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_app_role: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      current_skills: { Args: never; Returns: string[] }
      current_tenant_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { "": string }; Returns: string }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      isnt_empty: { Args: { "": string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      manager_comm_pct: { Args: never; Returns: number }
      manager_gig_pct: { Args: never; Returns: number }
      materialize_order: {
        Args: {
          p_actor: string
          p_code: string
          p_customer: string
          p_ref: string
          p_service: string
          p_tenant: string
          p_value: number
        }
        Returns: {
          assignee_id: string | null
          checkout_ref: string | null
          code: string
          created_at: string
          customer_id: string
          deadline: string | null
          id: string
          pkg: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          service: string
          source: Database["public"]["Enums"]["order_source"]
          state: Database["public"]["Enums"]["order_state"]
          tenant_id: string
          value: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      order_assignee_id: { Args: { p_order: string }; Returns: string }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      post_affiliate_commission: {
        Args: {
          p_actor: string
          p_affiliate: string
          p_amount: number
          p_order: string
        }
        Returns: undefined
      }
      post_staff_pay: {
        Args: {
          p_actor: string
          p_commission: number
          p_gig: number
          p_order: string
          p_staff: string
        }
        Returns: undefined
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      topup: {
        Args: {
          p_actor: string
          p_amount: number
          p_customer: string
          p_stripe?: string
          p_tenant: string
        }
        Returns: undefined
      }
    }
    Enums: {
      affiliate_status: "pending" | "active" | "churned"
      affiliate_tier: "bronze" | "silver" | "gold" | "platinum"
      app_role: "admin" | "manager" | "staff" | "customer" | "affiliate"
      broadcast_kind: "announcement" | "alert" | "update"
      broadcast_status: "draft" | "scheduled" | "live" | "recalled"
      customer_status: "shadow" | "claimed"
      customer_tier: "new" | "silver" | "gold" | "vip"
      deliverable_status: "submitted" | "approved" | "changes_requested"
      order_priority: "low" | "med" | "high"
      order_source: "quick" | "dashboard"
      order_state:
        | "new"
        | "confirmed"
        | "assigned"
        | "in_progress"
        | "internal_review"
        | "delivered"
        | "changes_requested"
        | "approved"
        | "completed"
        | "canceled"
      pricing_type: "flat" | "range" | "usage" | "custom"
      sla_tier: "urgent" | "standard"
      task_state: "pending" | "in_progress" | "submitted" | "done"
      ticket_channel: "portal" | "whatsapp" | "messenger" | "email"
      ticket_status: "open" | "pending" | "resolved" | "closed"
      ticket_type: "technical" | "billing" | "consultation"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
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
    Enums: {
      affiliate_status: ["pending", "active", "churned"],
      affiliate_tier: ["bronze", "silver", "gold", "platinum"],
      app_role: ["admin", "manager", "staff", "customer", "affiliate"],
      broadcast_kind: ["announcement", "alert", "update"],
      broadcast_status: ["draft", "scheduled", "live", "recalled"],
      customer_status: ["shadow", "claimed"],
      customer_tier: ["new", "silver", "gold", "vip"],
      deliverable_status: ["submitted", "approved", "changes_requested"],
      order_priority: ["low", "med", "high"],
      order_source: ["quick", "dashboard"],
      order_state: [
        "new",
        "confirmed",
        "assigned",
        "in_progress",
        "internal_review",
        "delivered",
        "changes_requested",
        "approved",
        "completed",
        "canceled",
      ],
      pricing_type: ["flat", "range", "usage", "custom"],
      sla_tier: ["urgent", "standard"],
      task_state: ["pending", "in_progress", "submitted", "done"],
      ticket_channel: ["portal", "whatsapp", "messenger", "email"],
      ticket_status: ["open", "pending", "resolved", "closed"],
      ticket_type: ["technical", "billing", "consultation"],
    },
  },
} as const

