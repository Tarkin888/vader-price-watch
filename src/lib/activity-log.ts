import { supabase } from "@/integrations/supabase/client";

export type ActivityEventType =
  // Legacy snake_case (do not rename — IPT-53 depends on these)
  | "scrape_run"
  | "record_added"
  | "record_edited"
  | "record_viewed"
  | "note_created"
  | "note_updated"
  | "note_deleted"
  | "classification_fixed"
  | "favourite_added"
  | "favourite_removed"
  | "collection_added"
  | "collection_edited"
  | "collection_removed"
  // Dotted (new spec)
  | "auth.login"
  | "auth.logout"
  | "auth.signup"
  | "auth.approved"
  | "page.view"
  | "scrape.run"
  | "record.edit"
  | "record.view"
  | "record.favourite"
  | "classification.correct"
  | "note.create"
  | "note.update"
  | "note.delete"
  | "note.create_from_kenny"
  | "chat.message"
  | "inventory.add"
  | "inventory.edit"
  | "inventory.csv_import";

/**
 * Fire-and-forget activity log insert.
 * Silently swallows errors — activity logging should never block the UI.
 */
export function logActivity(
  eventType: ActivityEventType,
  entityRef?: string | null,
  metadata?: Record<string, unknown> | null
) {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    supabase
      .from("user_activity" as any)
      .insert({
        user_id: user.id,
        event_type: eventType,
        entity_ref: entityRef ?? null,
        metadata: metadata ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn("Activity log failed:", error.message);
      });
  });
}
