from app.schemas.schemas import ProductResponse
from app.models.models import Product, ProductDetail

p = Product(id=1, name="Test", slug="test", images=None, tags=None)
try:
    ProductResponse.from_orm(p)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
