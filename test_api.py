import requests
import os
import json

BASE_URL = "http://127.0.0.1:8000"
TOKEN = None # Need to get a valid token

def get_token():
    # Try to login with default admin credentials
    try:
        res = requests.post(f"{BASE_URL}/auth/login", data={"username": "admin@admin.com", "password": "admin123"})
        if res.status_code == 200:
            return res.json()["access_token"]
    except Exception as e:
        print(f"Error logging in: {e}")
    return None

def create_post(title, content, file_path=None, media_type="image"):
    token = get_token()
    if not token:
        print("Could not get token")
        return

    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "title": title,
        "content": content,
        "media_type": media_type
    }
    
    files = None
    if file_path and os.path.exists(file_path):
        files = {"file": (os.path.basename(file_path), open(file_path, "rb"), "image/jpeg" if media_type == "image" else "video/mp4")}

    try:
        res = requests.post(f"{BASE_URL}/news/", headers=headers, data=data, files=files)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.json()}")
    except Exception as e:
        print(f"Error creating post: {e}")

if __name__ == "__main__":
    # Test text only
    print("Testing text post...")
    create_post("Teste de Texto", "Conteúdo de teste apenas texto.")
    
    # Test with image from attached_assets
    img_path = "c:/Users/Gabriel Eduardo/Desktop/eco1/ecosopisv1/attached_assets/image_1768845444255.png"
    if os.path.exists(img_path):
        print(f"Testing image post with {img_path}...")
        create_post("Novidade Natural", "Nossa nova linha de cremes veganos chegou! #vegan #natural", img_path, "image")
    else:
        print(f"Image not found at {img_path}")

    # Test dummy video (backend should detect by extension)
    dummy_video_path = "c:/Users/Gabriel Eduardo/Desktop/eco1/ecosopisv1/test_dummy.mp4"
    with open(dummy_video_path, "wb") as f:
        f.write(b"dummy video content")
    
    print("Testing dummy video post...")
    create_post("Vídeo de Demonstração", "Veja como nossos produtos são feitos com amor.", dummy_video_path, "video")
    
    # Cleanup dummy
    if os.path.exists(dummy_video_path):
        os.remove(dummy_video_path)
