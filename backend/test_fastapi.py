from fastapi import UploadFile
import io

file = UploadFile(filename="IMG_8995.MP4", file=io.BytesIO(b"test"), headers={"content-type": None})
content_type = file.content_type or "application/octet-stream"
print(f"file.content_type is {repr(file.content_type)}")
print(f"content_type is {repr(content_type)}")

file2 = UploadFile(filename="IMG_8995.MP4", file=io.BytesIO(b"test"))
file2.content_type = None
content_type2 = file2.content_type or "application/octet-stream"
print(f"file2.content_type is {repr(file2.content_type)}")
print(f"content_type2 is {repr(content_type2)}")
