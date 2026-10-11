#!/usr/bin/env python3
"""ERD generator. Schema data below was read from the LIVE Supabase project
(hjxtbnmnwlbqgptgncoh, schema `public`) via read-only catalog queries."""
import html, sys, json

# ---- schema: table -> (group, kind, [(col, type, nn)], pk list) ------------
T = {}
def t(name, group, cols, pk=("id",), kind="table"):
    T[name] = dict(group=group, kind=kind, pk=list(pk),
                   cols=[(c, ty, nn) for c, ty, nn in cols])

TS = "timestamptz"
t("profiles", "identity", [
 ("id","uuid",1),("role","user_role",1),("full_name","text",0),("username","text",0),
 ("avatar_url","text",0),("phone","text",0),("bio","text",0),("created_at",TS,1),
 ("updated_at",TS,1),("payment_qr_url","text",0),("is_active","bool",1),
 ("username_changed_at",TS,0),("gender","gender_type",0),("date_of_birth","date",0)])
t("addresses", "identity", [
 ("id","uuid",1),("user_id","uuid",1),("label","text",1),("recipient_name","text",1),
 ("phone","text",1),("region","text",0),("province","text",0),("city","text",1),
 ("barangay","text",0),("street_details","text",1),("postal_code","text",1),
 ("country","text",1),("is_default","bool",1),("created_at",TS,1),("updated_at",TS,1)])
t("buyer_preferences", "identity", [
 ("user_id","uuid",1),("order_updates","bool",1),("promotions","bool",1),
 ("push_enabled","bool",1),("email_enabled","bool",1),("sms_enabled","bool",1),
 ("default_payment_method","text",0),("created_at",TS,1),("updated_at",TS,1)], pk=("user_id",))
t("admin_action_log", "identity", [
 ("id","uuid",1),("actor_id","uuid",0),("action","text",1),("target_user_id","uuid",0),
 ("target_shop_id","uuid",0),("metadata","jsonb",0),("created_at",TS,1)])
t("shops", "identity", [
 ("id","uuid",1),("name","text",1),("slug","text",1),("active","bool",1),
 ("created_at",TS,1),("updated_at",TS,1),("logo_url","text",0),("banner_url","text",0),
 ("description","text",0)])
t("shop_users", "identity", [
 ("id","uuid",1),("shop_id","uuid",1),("user_id","uuid",1),("created_at",TS,1)])
t("rate_limit_hits", "infra", [
 ("key","text",1),("window_start",TS,1),("hit_count","int4",1)], pk=("key","window_start"))
t("order_idempotency_keys", "infra", [
 ("buyer_id","uuid",1),("idempotency_key","uuid",1),("scope","uuid",1),
 ("order_ids","uuid[]",1),("created_at",TS,1)], pk=("buyer_id","idempotency_key","scope"))

t("carts", "cart", [("id","uuid",1),("user_id","uuid",1),("created_at",TS,1),("updated_at",TS,1)])
t("cart_items", "cart", [
 ("id","uuid",1),("cart_id","uuid",1),("product_id","uuid",1),("variant_id","uuid",0),
 ("quantity","int4",1),("created_at",TS,1),("updated_at",TS,1)])
t("wishlists", "cart", [
 ("id","uuid",1),("user_id","uuid",1),("product_id","uuid",1),("created_at",TS,1)])

t("categories", "catalog", [
 ("id","uuid",1),("parent_id","uuid",0),("name","text",1),("slug","text",1),
 ("description","text",0),("icon","text",0),("image_url","text",0),("active","bool",1),
 ("sort_order","int4",1),("created_at",TS,1),("updated_at",TS,1)])
t("products", "catalog", [
 ("id","uuid",1),("seller_id","uuid",0),("category_id","uuid",0),("title","text",1),
 ("slug","text",1),("description","text",0),("price_cents","int4",1),("currency","char(3)",1),
 ("quantity","int4",1),("condition","product_condition",1),("status","product_status",1),
 ("featured","bool",1),("location","text",0),("tags","text[]",1),("views_count","int4",1),
 ("published_at",TS,0),("created_at",TS,1),("updated_at",TS,1),("search_vector","tsvector",0),
 ("shop_id","uuid",0)])
t("product_variants", "catalog", [
 ("id","uuid",1),("product_id","uuid",1),("seller_id","uuid",0),("shop_id","uuid",0),
 ("sku","text",0),("color","text",0),("size","text",0),("price_cents","int4",0),
 ("status","product_status",1),("created_at",TS,1),("updated_at",TS,1)])
t("product_images", "catalog", [
 ("id","uuid",1),("product_id","uuid",1),("url","text",1),("alt_text","text",0),
 ("sort_order","int4",1),("created_at",TS,1)])
t("recommendation_rules", "catalog", [
 ("id","uuid",1),("product_id","uuid",1),("variant_id","uuid",0),("seller_id","uuid",1),
 ("shop_id","uuid",0),("occasion","recommendation_occasion",0),("size","text",0),
 ("active","bool",1),("created_at",TS,1),("updated_at",TS,1)])
t("inventory", "inventory", [
 ("id","uuid",1),("product_id","uuid",1),("shop_id","uuid",0),("quantity","int4",1),
 ("low_stock_threshold","int4",1),("created_at",TS,1),("updated_at",TS,1),("variant_id","uuid",0)])
t("stock_adjustments", "inventory", [
 ("id","uuid",1),("product_id","uuid",1),("shop_id","uuid",0),("delta","int4",1),
 ("previous_quantity","int4",1),("new_quantity","int4",1),("reason","stock_adjustment_reason",1),
 ("note","text",0),("related_order_id","uuid",0),("created_by","uuid",0),("created_at",TS,1),
 ("variant_id","uuid",0)])

t("orders", "orders", [
 ("id","uuid",1),("order_number","text",1),("buyer_id","uuid",1),("seller_id","uuid",0),
 ("subtotal_cents","int4",1),("shipping_fee_cents","int4",1),("total_cents","int4",1),
 ("currency","char(3)",1),("payment_status","payment_status",1),("order_status","order_status",1),
 ("shipping_address","jsonb",1),("notes","text",0),("placed_at",TS,1),("paid_at",TS,0),
 ("shipped_at",TS,0),("delivered_at",TS,0),("cancelled_at",TS,0),("created_at",TS,1),
 ("updated_at",TS,1),("checkout_group_id","uuid",0),("cancellation_reason","text",0),
 ("cancelled_by","user_role",0),("payment_method","order_payment_method",1),("shop_id","uuid",0),
 ("buyer_confirmed_received_at",TS,0)])
t("order_items", "orders", [
 ("id","uuid",1),("order_id","uuid",1),("product_id","uuid",1),("product_title","text",1),
 ("quantity","int4",1),("unit_price_cents","int4",1),("subtotal_cents","int4",1),
 ("created_at",TS,1),("variant_id","uuid",0),("variant_label","text",0)])
t("order_shipments", "orders", [
 ("id","uuid",1),("order_id","uuid",1),("seller_id","uuid",0),("packed_at",TS,0),
 ("courier","text",0),("tracking_number","text",0),("created_at",TS,1),("updated_at",TS,1),
 ("shop_id","uuid",0)])
t("reviews", "orders", [
 ("id","uuid",1),("order_item_id","uuid",1),("product_id","uuid",1),("buyer_id","uuid",1),
 ("reviewer_display_name","text",0),("rating","int2",1),("comment","text",0),("created_at",TS,1)])
t("buyer_order_lifecycle", "orders", [
 ("order_id","uuid",0),("buyer_id","uuid",0),("placed_at",TS,0),
 ("active_payment_channel","text",0),("lifecycle_tab","text",0)], pk=(), kind="view")

t("payments", "payments", [
 ("id","uuid",1),("order_id","uuid",1),("receipt_path","text",0),("failure_reason","text",0),
 ("payment_method_type","payment_method_type",1),("amount_cents","int4",1),("currency","char(3)",1),
 ("status","payment_status",1),("created_at",TS,1),("updated_at",TS,1),("verified_by","uuid",0),
 ("verified_at",TS,0),("xendit_payment_request_id","text",0),("xendit_payment_id","text",0),
 ("payment_channel","text",0),("checkout_url","text",0),("expires_at",TS,0),
 ("provider_response","jsonb",0),("checkout_group_id","uuid",0)])
t("payment_webhook_events", "payments", [
 ("id","uuid",1),("received_at",TS,1),("xendit_payment_request_id","text",0),
 ("xendit_payment_id","text",0),("reference_id","uuid",0),("event_type","text",0),
 ("status","text",0),("payment_row_id","uuid",0),("processing_result","text",1),
 ("raw_payload","jsonb",1)])
t("xendit_refunds", "payments", [
 ("id","uuid",1),("return_request_id","uuid",1),("payment_id","uuid",1),
 ("xendit_payment_request_id","text",1),("xendit_refund_id","text",0),("amount_cents","int4",1),
 ("currency","text",1),("status","xendit_refund_status",1),("failure_code","text",0),
 ("raw_response","jsonb",0),("created_at",TS,1),("updated_at",TS,1)])
t("return_requests", "payments", [
 ("id","uuid",1),("order_id","uuid",1),("order_item_id","uuid",0),("buyer_id","uuid",1),
 ("seller_id","uuid",0),("reason","text",1),("evidence_path","text",0),("status","return_status",1),
 ("seller_decision_note","text",0),("seller_decided_at",TS,0),("seller_decided_by","uuid",0),
 ("admin_decision_note","text",0),("admin_decided_at",TS,0),("admin_decided_by","uuid",0),
 ("refund_amount_cents","int4",0),("created_at",TS,1),("updated_at",TS,1),("shop_id","uuid",0),
 ("restocked_at",TS,0),("marked_unsellable_at",TS,0),("condition_note","text",0),
 ("condition_recorded_by","uuid",0)])
# external stub (Supabase Auth schema, not part of `public`)
t("auth.users", "auth", [("id","uuid",1)], kind="external")

# ---- foreign keys (from pg_constraint): child, col, parent, pcol, on delete -
C, N, R, A = "CASCADE", "SET NULL", "RESTRICT", "NO ACTION"
FK = [
 ("profiles","id","auth.users","id",C),
 ("addresses","user_id","profiles","id",C),
 ("buyer_preferences","user_id","profiles","id",C),
 ("admin_action_log","actor_id","profiles","id",N),
 ("admin_action_log","target_user_id","profiles","id",N),
 ("admin_action_log","target_shop_id","shops","id",N),
 ("shop_users","shop_id","shops","id",C),
 ("shop_users","user_id","profiles","id",C),
 ("order_idempotency_keys","buyer_id","profiles","id",C),
 ("carts","user_id","profiles","id",C),
 ("cart_items","cart_id","carts","id",C),
 ("cart_items","product_id","products","id",C),
 ("cart_items","variant_id","product_variants","id",C),
 ("wishlists","user_id","profiles","id",C),
 ("wishlists","product_id","products","id",C),
 ("categories","parent_id","categories","id",N),
 ("products","category_id","categories","id",N),
 ("products","seller_id","profiles","id",N),
 ("products","shop_id","shops","id",N),
 ("product_variants","product_id","products","id",C),
 ("product_variants","seller_id","profiles","id",N),
 ("product_variants","shop_id","shops","id",N),
 ("product_images","product_id","products","id",C),
 ("recommendation_rules","product_id","products","id",C),
 ("recommendation_rules","variant_id","product_variants","id",C),
 ("recommendation_rules","seller_id","profiles","id",C),
 ("recommendation_rules","shop_id","shops","id",N),
 ("inventory","product_id","products","id",C),
 ("inventory","variant_id","product_variants","id",C),
 ("inventory","shop_id","shops","id",N),
 ("stock_adjustments","product_id","products","id",C),
 ("stock_adjustments","variant_id","product_variants","id",C),
 ("stock_adjustments","shop_id","shops","id",N),
 ("stock_adjustments","related_order_id","orders","id",N),
 ("stock_adjustments","created_by","profiles","id",N),
 ("orders","buyer_id","profiles","id",R),
 ("orders","seller_id","profiles","id",N),
 ("orders","shop_id","shops","id",A),
 ("order_items","order_id","orders","id",C),
 ("order_items","product_id","products","id",R),
 ("order_items","variant_id","product_variants","id",R),
 ("order_shipments","order_id","orders","id",A),
 ("order_shipments","seller_id","profiles","id",N),
 ("order_shipments","shop_id","shops","id",A),
 ("reviews","order_item_id","order_items","id",R),
 ("reviews","product_id","products","id",C),
 ("reviews","buyer_id","profiles","id",C),
 ("payments","order_id","orders","id",R),
 ("payments","verified_by","profiles","id",A),
 ("payment_webhook_events","payment_row_id","payments","id",A),
 ("xendit_refunds","return_request_id","return_requests","id",A),
 ("xendit_refunds","payment_id","payments","id",A),
 ("return_requests","order_id","orders","id",A),
 ("return_requests","order_item_id","order_items","id",A),
 ("return_requests","buyer_id","profiles","id",A),
 ("return_requests","seller_id","profiles","id",N),
 ("return_requests","seller_decided_by","profiles","id",N),
 ("return_requests","admin_decided_by","profiles","id",A),
 ("return_requests","condition_recorded_by","profiles","id",N),
 ("return_requests","shop_id","shops","id",A),
]
# logical (non-FK) links, drawn dashed
LOGICAL = [
 ("payments","checkout_group_id","orders","checkout_group_id","shared checkout_group_id (no FK)"),
 ("buyer_order_lifecycle","order_id","orders","id","view over orders (security_invoker)"),
 ("payment_webhook_events","reference_id","payments","id","reference_id (no FK)"),
]
UNIQ = {("carts","user_id"),("categories","slug"),("order_shipments","order_id"),
        ("orders","order_number"),("products","slug"),("reviews","order_item_id"),
        ("shops","slug"),("xendit_refunds","xendit_refund_id"),("shop_users","user_id"),
        ("profiles","username")}

# ---- style -----------------------------------------------------------------
GROUP = {  # header color, tint
 "identity": ("#3b5bdb", "Identity, shops & admin"),
 "cart":     ("#7048e8", "Cart & wishlist"),
 "catalog":  ("#0b7285", "Catalog"),
 "inventory":("#2b8a3e", "Inventory"),
 "orders":   ("#c2410c", "Orders & reviews"),
 "payments": ("#a61e4d", "Payments, refunds & returns"),
 "infra":    ("#495057", "Infrastructure"),
 "auth":     ("#868e96", "Supabase Auth (external)"),
}
DEL = {C: ("#e03131", "ON DELETE CASCADE"), N: ("#f08c00", "ON DELETE SET NULL"),
       R: ("#1971c2", "ON DELETE RESTRICT"), A: ("#5c7080", "ON DELETE NO ACTION")}
ROW, HEAD, PADX, W = 19, 30, 10, 336
FONT = "Inter, 'DejaVu Sans', Arial, sans-serif"
MONO = "'DejaVu Sans Mono', Menlo, monospace"

def esc(s): return html.escape(str(s))

def fkcols(name):
    return {c: (p, d) for (ch, c, p, pc, d) in FK if ch == name}

def tbox_height(name, collapsed):
    n = 1 if collapsed else len(T[name]["cols"])
    return HEAD + n * ROW + 6 + (ROW if collapsed else 0)

def render(layout, title, subtitle, out_svg, collapsed=(), edge_filter=None, width_pad=60, show_logical=True, legend=True):
    """layout: {table: (x, y)} absolute px (table top-left, before padding)."""
    pos, size = {}, {}
    for n, (x, y) in layout.items():
        col = n in collapsed
        pos[n] = (x, y); size[n] = (W, tbox_height(n, col))
    minx = min(x for x, _ in pos.values()); miny = min(y for _, y in pos.values())
    maxx = max(pos[n][0] + size[n][0] for n in pos); maxy = max(pos[n][1] + size[n][1] for n in pos)
    LEG_H = 175 if legend else 0
    TOP = 110
    Wd = int(maxx - minx + 2 * width_pad + 120); Ht = int(maxy - miny + TOP + LEG_H + 70)
    ox, oy = width_pad + 60 - minx, TOP - miny
    def anchor(tn, col, side):
        x, y = pos[tn]; w, h = size[tn]
        if tn in collapsed or col is None:
            ry = y + HEAD + ROW / 2
        else:
            names = [c for c, _, _ in T[tn]["cols"]]
            ry = y + HEAD + names.index(col) * ROW + ROW / 2
        return (x + (w if side == "R" else 0) + ox, ry + oy)

    edges, defs = [], []
    drawn = 0
    for (ch, col, pa, pc, d) in FK:
        if ch not in pos or pa not in pos: continue
        if edge_filter and not edge_filter(ch, col, pa): continue
        cx, cy = pos[ch]; px, py = pos[pa]
        color = DEL[d][0]
        if ch == pa:   # self reference: loop on right
            x1, y1 = anchor(ch, col, "R"); x2, y2 = anchor(pa, pc, "R")
            dx = 46
            path = f"M{x1},{y1} C{x1+dx},{y1} {x2+dx},{y2} {x2},{y2}"
            s1, s2 = 1, -1
        else:
            same_col = abs(cx - px) < 5
            if same_col:
                side = "R"; x1, y1 = anchor(ch, col, "R"); x2, y2 = anchor(pa, pc, "R")
                dx = 50 + 6 * (abs(y1 - y2) // 120 % 6)
                path = f"M{x1},{y1} C{x1+dx},{y1} {x2+dx},{y2} {x2},{y2}"
                s1 = s2 = 1
            else:
                if cx < px: sc, sp = "R", "L"
                else: sc, sp = "L", "R"
                x1, y1 = anchor(ch, col, sc); x2, y2 = anchor(pa, pc, sp)
                dx = max(50, abs(x2 - x1) * 0.45)
                a = 1 if sc == "R" else -1
                path = f"M{x1},{y1} C{x1+a*dx},{y1} {x2-a*dx},{y2} {x2},{y2}"
                s1 = a; s2 = -a
        edges.append((path, color, (x1, y1, s1), (x2, y2, s2), ch, col, pa, d))
        drawn += 1
    logic = []
    if show_logical:
        for (ch, col, pa, pc, lbl) in LOGICAL:
            if ch not in pos or pa not in pos: continue
            if edge_filter and not edge_filter(ch, col, pa): continue
            cx, _ = pos[ch]; px, _ = pos[pa]
            if abs(cx - px) < 5:
                x1, y1 = anchor(ch, col, "R"); x2, y2 = anchor(pa, pc, "R"); dx = 60
                path = f"M{x1},{y1} C{x1+dx},{y1} {x2+dx},{y2} {x2},{y2}"
            else:
                sc, sp = ("R", "L") if cx < px else ("L", "R")
                x1, y1 = anchor(ch, col, sc); x2, y2 = anchor(pa, pc, sp)
                dx = max(50, abs(x2 - x1) * 0.45); a = 1 if sc == "R" else -1
                path = f"M{x1},{y1} C{x1+a*dx},{y1} {x2-a*dx},{y2} {x2},{y2}"
            logic.append(path)

    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{Wd}" height="{Ht}" viewBox="0 0 {Wd} {Ht}" font-family="{FONT}">')
    o.append(f'<rect width="100%" height="100%" fill="#f8f9fb"/>')
    o.append(f'<text x="40" y="52" font-size="30" font-weight="700" fill="#16202c">{esc(title)}</text>')
    o.append(f'<text x="40" y="80" font-size="14.5" fill="#566574">{esc(subtitle)}</text>')
    # group bands (tint behind each domain's tables)
    gb = {}
    for n in pos:
        g = T[n]["group"]; x, y = pos[n]; w, h = size[n]
        b = gb.setdefault(g, [x, y, x + w, y + h])
        b[0] = min(b[0], x); b[1] = min(b[1], y); b[2] = max(b[2], x + w); b[3] = max(b[3], y + h)
    # edges first (behind tables)
    for path in logic:
        o.append(f'<path d="{path}" fill="none" stroke="#868e96" stroke-width="1.6" stroke-dasharray="6 5" opacity=".85"/>')
    for (path, color, a1, a2, ch, col, pa, d) in edges:
        o.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.7" opacity=".62"/>')
    # tables
    for n, (x, y) in pos.items():
        w, h = size[n]; tx, ty = x + ox, y + oy
        g = T[n]["group"]; hc = GROUP[g][0]
        col = n in collapsed
        dash = ' stroke-dasharray="5 4"' if T[n]["kind"] in ("view", "external") else ""
        o.append(f'<g>')
        o.append(f'<rect x="{tx+2}" y="{ty+3}" width="{w}" height="{h}" rx="8" fill="#0b1220" opacity=".10"/>')
        o.append(f'<rect x="{tx}" y="{ty}" width="{w}" height="{h}" rx="8" fill="#ffffff" stroke="{hc}" stroke-width="1.6"{dash}/>')
        o.append(f'<path d="M{tx},{ty+HEAD} V{ty+8} a8,8 0 0 1 8,-8 H{tx+w-8} a8,8 0 0 1 8,8 V{ty+HEAD} Z" fill="{hc}"/>')
        label = n + ("  ·  VIEW" if T[n]["kind"] == "view" else "")
        o.append(f'<text x="{tx+PADX}" y="{ty+20}" font-size="14.5" font-weight="700" fill="#fff">{esc(label)}</text>')
        if n != "auth.users" and T[n]["kind"] != "view":
            o.append(f'<text x="{tx+w-PADX}" y="{ty+20}" font-size="11" fill="#ffffffcc" text-anchor="end">{ROWS.get(n,"")}</text>')
        fks = fkcols(n)
        cols = T[n]["cols"][:1] if col else T[n]["cols"]
        for i, (cn, ct, nn) in enumerate(cols):
            ry = ty + HEAD + i * ROW
            if i % 2 == 1: o.append(f'<rect x="{tx+1}" y="{ry}" width="{w-2}" height="{ROW}" fill="#f4f6fa"/>')
            ispk = cn in T[n]["pk"]; isfk = cn in fks; isuq = (n, cn) in UNIQ
            bx = tx + PADX
            if ispk: o.append(f'<text x="{bx}" y="{ry+13.5}" font-size="9.5" font-weight="700" fill="#e8590c" font-family="{MONO}">PK</text>')
            elif isfk: o.append(f'<text x="{bx}" y="{ry+13.5}" font-size="9.5" font-weight="700" fill="{DEL[fks[cn][1]][0]}" font-family="{MONO}">FK</text>')
            elif isuq: o.append(f'<text x="{bx}" y="{ry+13.5}" font-size="9.5" font-weight="700" fill="#6741d9" font-family="{MONO}">UQ</text>')
            if ispk and isfk:
                o.append(f'<text x="{bx+16}" y="{ry+13.5}" font-size="9.5" font-weight="700" fill="{DEL[fks[cn][1]][0]}" font-family="{MONO}">FK</text>')
            nx = bx + (34 if (ispk and isfk) else 22)
            weight = "600" if ispk else "400"
            o.append(f'<text x="{nx}" y="{ry+13.5}" font-size="12.2" font-weight="{weight}" fill="#1b2430">{esc(cn)}</text>')
            ty_txt = ct + ("" if nn else "?")
            tgt = f"  → {fks[cn][0]}" if (isfk and not col) else ""
            o.append(f'<text x="{tx+w-PADX}" y="{ry+13.5}" font-size="11" fill="#6b7785" text-anchor="end" font-family="{MONO}">{esc(ty_txt)}</text>')
        if col:
            o.append(f'<text x="{tx+PADX+22}" y="{ty+HEAD+ROW+13}" font-size="10.5" fill="#868e96" font-style="italic">(columns omitted — see main diagram)</text>')
            # not counted in height; keep box slightly taller handled by +6
        o.append('</g>')
    # relationship end markers (crow's foot at child, bar at parent)
    for (path, color, a1, a2, ch, col, pa, d) in edges:
        x1, y1, s1 = a1; x2, y2, s2 = a2
        # child end: crow's foot (many)
        o.append(f'<path d="M{x1},{y1} l{s1*12},-6 M{x1},{y1} l{s1*12},6 M{x1},{y1} l{s1*12},0" stroke="{color}" stroke-width="1.7" fill="none"/>')
        # parent end: single bar (one)
        o.append(f'<path d="M{x2+s2*8},{y2-6} v12" stroke="{color}" stroke-width="2" fill="none"/>')
        o.append(f'<circle cx="{x1}" cy="{y1}" r="2.2" fill="{color}"/><circle cx="{x2}" cy="{y2}" r="2.2" fill="{color}"/>')
    if legend:
        ly = Ht - LEG_H + 10
        o.append(f'<rect x="40" y="{ly}" width="{Wd-80}" height="{LEG_H-24}" rx="10" fill="#fff" stroke="#d5dbe3"/>')
        o.append(f'<text x="58" y="{ly+26}" font-size="13" font-weight="700" fill="#16202c">Legend</text>')
        lx = 58
        for k in (C, N, R, A):
            o.append(f'<line x1="{lx}" y1="{ly+46}" x2="{lx+34}" y2="{ly+46}" stroke="{DEL[k][0]}" stroke-width="3"/>')
            o.append(f'<text x="{lx+42}" y="{ly+50}" font-size="12" fill="#2b3642">{DEL[k][1]}</text>')
            lx += 190
        o.append(f'<line x1="{lx}" y1="{ly+46}" x2="{lx+34}" y2="{ly+46}" stroke="#868e96" stroke-width="2" stroke-dasharray="6 5"/>')
        o.append(f'<text x="{lx+42}" y="{ly+50}" font-size="12" fill="#2b3642">logical link (no FK constraint)</text>')
        lx = 58
        items = [("PK","#e8590c","primary key"),("FK","#e03131","foreign key (color = delete rule)"),("UQ","#6741d9","unique column"),
                 ("type?","#6b7785","nullable column (no ? = NOT NULL)")]
        for tx_, c_, d_ in items:
            o.append(f'<text x="{lx}" y="{ly+78}" font-size="11" font-weight="700" fill="{c_}" font-family="{MONO}">{esc(tx_)}</text>')
            o.append(f'<text x="{lx+(46 if len(tx_)>2 else 24)}" y="{ly+78}" font-size="12" fill="#2b3642">{esc(d_)}</text>')
            lx += 260
        o.append(f'<text x="58" y="{ly+102}" font-size="12" fill="#2b3642">Crow\'s foot = many (child FK column) · bar = one (referenced PK) · row counts = exact COUNT(*) at audit time</text>')
        # group colors
        gx = 58; gy = ly + 128
        for g, (c_, nm) in GROUP.items():
            if g in gb:
                o.append(f'<rect x="{gx}" y="{gy-9}" width="12" height="12" rx="3" fill="{c_}"/>')
                o.append(f'<text x="{gx+18}" y="{gy+1}" font-size="12" fill="#2b3642">{esc(nm)}</text>')
                gx += 40 + 7.4 * len(nm)
    o.append('</svg>')
    open(out_svg, "w").write("\n".join(o))
    return Wd, Ht, drawn

ROWS = {}  # filled from live counts
