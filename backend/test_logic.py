def test_logic(val):
    original_ct = val
    content_type = str(original_ct) if original_ct else "application/octet-stream"
    if content_type == "None": content_type = "application/octet-stream"
    return content_type

print(f"None -> {repr(test_logic(None))}")
print(f"'' -> {repr(test_logic(''))}")
print(f"'image/jpeg' -> {repr(test_logic('image/jpeg'))}")
print(f"'None' -> {repr(test_logic('None'))}")
