import sys
import os
# Add the current directory to sys.path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), 'backend')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Base, StoredImage

# Use in-memory SQLite for testing
engine = create_engine('sqlite:///:memory:')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
session = Session()

try:
    print("Test 1: Creating StoredImage with content_type=None")
    img1 = StoredImage(
        filename="test.mp4",
        content_type=None,
        data=b"dummy"
    )
    print(f"Result 1 content_type: {repr(img1.content_type)}")
    
    print("\nTest 2: Creating StoredImage with content_type='None' (string)")
    img2 = StoredImage(
        filename="test.mp4",
        content_type="None",
        data=b"dummy"
    )
    print(f"Result 2 content_type: {repr(img2.content_type)}")

    print("\nTest 3: Creating StoredImage with valid content_type")
    img3 = StoredImage(
        filename="test.jpg",
        content_type="image/jpeg",
        data=b"dummy"
    )
    print(f"Result 3 content_type: {repr(img3.content_type)}")

except Exception as e:
    print(f"\nERROR: {e}")
finally:
    session.close()
