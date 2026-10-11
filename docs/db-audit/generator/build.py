import sys, subprocess, os
sys.path.insert(0, os.path.dirname(__file__))
import erd
from erd import T, W, tbox_height

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

# live row counts (exact COUNT(*) at audit time; product_images/ rate etc. from catalog estimate)
erd.ROWS.update({
 "addresses":"9 rows","admin_action_log":"36 rows","buyer_preferences":"2 rows","cart_items":"13 rows",
 "carts":"13 rows","categories":"4 rows","inventory":"100 rows","order_idempotency_keys":"4 rows",
 "order_items":"176 rows","order_shipments":"12 rows","orders":"163 rows","payment_webhook_events":"143 rows",
 "payments":"175 rows","product_images":"~85 rows","product_variants":"0 rows","products":"100 rows",
 "profiles":"18 rows","rate_limit_hits":"8 rows","recommendation_rules":"0 rows","return_requests":"4 rows",
 "reviews":"2 rows","shop_users":"5 rows","shops":"3 rows","stock_adjustments":"387 rows",
 "wishlists":"5 rows","xendit_refunds":"5 rows",
})

GAPX, GAPY = 180, 46
def stack(cols, collapsed=(), x0=0, y_off=None):
    lay = {}
    for ci, names in enumerate(cols):
        y = (y_off or {}).get(ci, 0)
        for n in names:
            lay[n] = (x0 + ci * (W + GAPX), y)
            y += tbox_height(n, n in collapsed) + GAPY
    return lay

def build(name, title, sub, cols, collapsed=(), y_off=None, edge_filter=None, legend=True):
    lay = stack(cols, collapsed, y_off=y_off)
    svg = os.path.join(OUT, name + ".svg")
    w, h, n = erd.render(lay, title, sub, svg, collapsed=collapsed, edge_filter=edge_filter, legend=legend)
    return svg, w, h, n

jobs = []
# 1) full overview
jobs.append(build(
 "robertj-erd-overview",
 "RobertJ Online Shop — Entity-Relationship Diagram (full database)",
 "Supabase project hjxtbnmnwlbqgptgncoh · Postgres 17 · schema public · 25 tables + 1 view (+ auth.users) · 60 foreign keys · generated from the live catalog (read-only)",
 [
  ["auth.users","addresses","buyer_preferences","carts","cart_items","wishlists","order_idempotency_keys","rate_limit_hits"],
  ["profiles","shop_users","shops","admin_action_log"],
  ["categories","products","product_variants","product_images","recommendation_rules"],
  ["inventory","stock_adjustments","reviews","order_items","orders","order_shipments","buyer_order_lifecycle"],
  ["payments","payment_webhook_events","xendit_refunds","return_requests"],
 ],
 y_off={0:0, 1:120, 2:0, 3:0, 4:900}))

# 2) detail: identity / shops / customer
jobs.append(build(
 "robertj-erd-detail-1-identity-shops-customer",
 "Detail 1 — Identity, shops, customer data",
 "profiles is the hub of the schema (FK target of 22 relationships). Tables outside this domain are shown collapsed.",
 [
  ["auth.users","addresses","buyer_preferences","carts","cart_items","wishlists"],
  ["profiles","shop_users","shops","admin_action_log"],
  ["products","product_variants","orders"],
 ],
 collapsed=("products","product_variants","orders","auth.users"),
 y_off={0:0,1:60,2:60},
 edge_filter=lambda ch,col,pa: not (ch in ("products","product_variants","orders") and pa not in ("profiles","shops")) or ch in ("cart_items","wishlists")))

# 3) detail: catalog & inventory
jobs.append(build(
 "robertj-erd-detail-2-catalog-inventory",
 "Detail 2 — Catalog, variants & inventory",
 "Stock lives in two places: products.quantity and inventory.quantity (per product or per variant). Neighbouring tables collapsed.",
 [
  ["categories","product_images","recommendation_rules","wishlists","cart_items"],
  ["products","product_variants"],
  ["inventory","stock_adjustments","shops","profiles","orders"],
 ],
 collapsed=("shops","profiles","orders","wishlists","cart_items"),
 y_off={0:0,1:0,2:0},
 edge_filter=lambda ch,col,pa: True))

# 4) detail: orders / payments / returns
jobs.append(build(
 "robertj-erd-detail-3-orders-payments-returns",
 "Detail 3 — Orders, payments, refunds & returns",
 "Order lifecycle from checkout to refund. payments/orders are linked by FK (order_id) and logically by checkout_group_id.",
 [
  ["profiles","shops","products","product_variants"],
  ["orders","order_items","order_shipments","reviews","buyer_order_lifecycle"],
  ["payments","payment_webhook_events","xendit_refunds","return_requests"],
 ],
 collapsed=("profiles","shops","products","product_variants"),
 y_off={0:80,1:0,2:0},
 edge_filter=lambda ch,col,pa: not (ch in ("orders","order_items","order_shipments","reviews","payments","return_requests","stock_adjustments") and pa in ("profiles","shops","products","product_variants")) or True))

print(json_ := [(s, w, h, n) for s, w, h, n in jobs])

chrome = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
if not os.path.exists(chrome):
    import glob; chrome = (glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome") or ["chromium"])[0]
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 2
for svg, w, h, n in jobs:
    png = svg[:-4] + ".png"
    html_path = svg[:-4] + ".tmp.html"
    open(html_path, "w").write(f'<html><body style="margin:0"><img src="file://{svg}" width="{w}" height="{h}" style="display:block"></body></html>')
    subprocess.run([chrome, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    f"--force-device-scale-factor={SCALE}", f"--window-size={w},{h+200}", f"--screenshot={png}",
                    "file://" + html_path], check=True, capture_output=True)
    os.remove(html_path)
    subprocess.run(["convert", png, "-crop", f"{int(w*SCALE)}x{int(h*SCALE)}+0+0", "+repage", png], check=True)
    print("rendered", png)
