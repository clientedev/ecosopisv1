"""
Estimativa inteligente de embalagem (peso + caixa) a partir dos produtos do pedido.

Usada tanto na COTAÇÃO de frete do cliente quanto na emissão da etiqueta no Melhor Envio,
para que o valor cobrado e o valor da etiqueta sejam calculados sobre o mesmo pacote.
Nada aqui exige edição manual: o sistema reconhece o tipo de produto pelo nome.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable, List, Dict, Any

# (peso unitário em kg, volume unitário aproximado em cm³) por tipo de produto
_SABONETE_BARRA = (0.10, 162.0)      # barra ~9x6x3 cm
_SABONETE_LIQUIDO = (0.30, 612.0)    # frasco ~6x6x17 cm
_OLEO_30 = (0.10, 176.0)             # frasco 30 ml com conta-gotas ~4x4x11 cm
_OLEO_60 = (0.15, 300.0)             # frasco/refil 60 ml
_CREME = (0.10, 216.0)               # pote ~6x6x6 cm
_TONICO = (0.15, 375.0)              # frasco 100 ml ~5x5x15 cm
_MANTEIGA = (0.15, 384.0)            # pote ~8x8x6 cm
_DESODORANTE = (0.10, 240.0)         # stick ~6x4x10 cm
_PADRAO = (0.10, 216.0)

# Caixas padrão (comprimento, largura, altura em cm, tara em kg) — todas dentro do mínimo dos Correios
_CAIXAS = [
    ("P", 20, 15, 10, 0.05),     # 3.000 cm³
    ("M", 25, 20, 15, 0.08),     # 7.500 cm³
    ("G", 30, 25, 20, 0.12),     # 15.000 cm³
    ("GG", 40, 30, 25, 0.20),    # 30.000 cm³
    ("XG", 50, 40, 30, 0.30),    # 60.000 cm³
]
_FATOR_ENCHIMENTO = 1.5          # espaço extra para proteção/papel


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", t).strip()


def _kit_multiplicador(n: str) -> int:
    """Kits de atacado ("60 unidades", "10 un") equivalem a N sabonetes."""
    m = re.search(r"(\d+)\s*(unidades|unidade|un)\b", n)
    if m:
        try:
            return max(1, min(int(m.group(1)), 500))
        except ValueError:
            return 1
    return 1


def unit_profile(name: str) -> Dict[str, Any]:
    """Retorna peso (kg) e volume (cm³) aproximados de UMA unidade vendida com esse nome."""
    n = _norm(name)
    mult = _kit_multiplicador(n)

    if "kit" in n and mult == 1:
        # Kits de varejo: ~3 itens pequenos dentro da caixa do kit
        if "acne" in n or "oleosidade" in n:
            w, v = 0.35, 700.0
        elif "sabonete" in n:
            w, v = 0.25, 500.0
        else:
            w, v = 0.30, 600.0
        return {"weight": w, "volume": v, "kind": "kit"}

    if "sabonete" in n and ("liquido" in n):
        w, v = _SABONETE_LIQUIDO
        kind = "sabonete_liquido"
    elif "sabonete" in n:
        w, v = _SABONETE_BARRA
        kind = "sabonete"
    elif "refil" in n or "60ml" in n.replace(" ", "") or "60 ml" in n:
        w, v = _OLEO_60
        kind = "oleo_60"
    elif "oleo" in n:
        w, v = _OLEO_30
        kind = "oleo"
    elif "creme" in n:
        w, v = _CREME
        kind = "creme"
    elif "tonico" in n:
        w, v = _TONICO
        kind = "tonico"
    elif "manteiga" in n:
        w, v = _MANTEIGA
        kind = "manteiga"
    elif "desodorante" in n:
        w, v = _DESODORANTE
        kind = "desodorante"
    else:
        w, v = _PADRAO
        kind = "outro"

    return {"weight": w * mult, "volume": v * mult, "kind": kind}


def estimate_package(items: Iterable[dict]) -> Dict[str, Any]:
    """
    items: [{"name"|"product_name": str, "quantity": int}, ...]
    Retorna {"weight": kg, "width": cm, "height": cm, "length": cm, "box": "P|M|G|GG|XG"}.
    """
    total_w = 0.0
    total_v = 0.0
    for it in items or []:
        name = it.get("name") or it.get("product_name") or ""
        try:
            qty = max(1, int(it.get("quantity") or 1))
        except (TypeError, ValueError):
            qty = 1
        prof = unit_profile(name)
        total_w += prof["weight"] * qty
        total_v += prof["volume"] * qty

    needed = max(total_v * _FATOR_ENCHIMENTO, 1.0)
    chosen = _CAIXAS[-1]
    for box in _CAIXAS:
        if box[1] * box[2] * box[3] >= needed:
            chosen = box
            break

    code, length, width, height, tara = chosen
    weight = round(max(total_w + tara, 0.1), 3)
    return {
        "weight": weight,
        "width": float(width),
        "height": float(height),
        "length": float(length),
        "box": code,
    }
