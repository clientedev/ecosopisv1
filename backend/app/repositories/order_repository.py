from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import Order, OrderItem

class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_order(self, user_id: int, total: float, shipping_price: float, shipping_method: str, items: Optional[List[dict]] = None, address: Optional[dict] = None, status: str = "pending", coupon_code: str = None, discount_amount: float = 0.0) -> Order:
        db_order = Order(
            user_id=user_id,
            status=status,
            total=total,
            shipping_price=shipping_price,
            shipping_method=shipping_method,
            items=items,
            address=address,
            coupon_code=coupon_code,
            discount_amount=discount_amount
        )
        self.db.add(db_order)
        self.db.flush() # flush to get the ID without committing
        return db_order

    def add_order_items(self, order_id: int, items_data: List[dict]):
        order_items = []
        for item in items_data:
            order_item = OrderItem(
                order_id=order_id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                price=item["price"]
            )
            order_items.append(order_item)
            self.db.add(order_item)
        self.db.flush()
        return order_items

    def get_order_by_id(self, order_id: int) -> Optional[Order]:
        return self.db.query(Order).filter(Order.id == order_id).first()

    def update_order(self, order: Order):
        self.db.add(order)
        self.db.flush()
        return order

    def update_order_status(self, order_id: int, status: str):
        order = self.get_order_by_id(order_id)
        if order:
            order.status = status
            self.db.add(order)
            self.db.flush()
        return order

    def save_stripe_session(self, order_id: int, session_id: str):
        order = self.get_order_by_id(order_id)
        if order:
            order.stripe_session_id = session_id
            self.db.add(order)
            self.db.flush()
        return order

    def save_tracking_code(self, order_id: int, tracking_code: str):
        order = self.get_order_by_id(order_id)
        if order:
            order.codigo_rastreio = tracking_code
            self.db.add(order)
            self.db.flush()
        return order
