import traceback
from app.core.database import SessionLocal
from app.models import models

def main():
    try:
        db = SessionLocal()
        user = db.query(models.User).first()
        print("User query success")
    except Exception as e:
        with open("error_out.txt", "w") as f:
            traceback.print_exc(file=f)
        print("Wrote error to error_out.txt")

if __name__ == "__main__":
    main()
