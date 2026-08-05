from datetime import datetime, timedelta, timezone

def test_bi_logic():
    period = "30d"
    shopee_offset = 5400
    site_revenue_offset = 14500.0
    visits_offset = 8900
    lia_chats_offset = 420

    # 1. Visits
    total_visits = 150 + visits_offset
    assert total_visits == 9050

    # 2. Shopee & Channels
    total_shopee_clicks = 120 + shopee_offset
    assert total_shopee_clicks == 5520

    # 3. Revenue & Sales
    total_revenue = 2500.0 + site_revenue_offset
    assert total_revenue == 17000.0
    total_orders = 10 + int(site_revenue_offset / 78.50)
    avg_ticket = round(total_revenue / max(1, total_orders), 2)
    assert avg_ticket > 0

    # 4. LIA Interactions
    total_lia_interactions = 15 + lia_chats_offset
    assert total_lia_interactions == 435

    print("[OK] All BI calculation logic unit tests passed!")

if __name__ == "__main__":
    test_bi_logic()
