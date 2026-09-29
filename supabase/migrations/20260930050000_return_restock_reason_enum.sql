-- =============================================================================
-- Adds the 'return_restock' stock_adjustment_reason value, used by
-- record_return_item_condition (next migration) to log a restock that
-- happened because a returned item was confirmed sellable — kept in its own
-- migration/transaction because a newly added enum value cannot safely be
-- referenced by a function body created in the same transaction that added
-- it.
-- =============================================================================

begin;

alter type public.stock_adjustment_reason add value if not exists 'return_restock';

commit;
