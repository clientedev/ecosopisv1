"""Legacy entry point kept for projects that still reference this filename.

The former roulette models are not part of the current application.
Promotions are now managed by the ScratchSettings and Coupon models, so this
script intentionally performs no database writes.
"""


def seed_prizes() -> None:
    print(
        "A roleta antiga não existe mais neste projeto; "
        "use o painel da raspadinha para configurar promoções."
    )


if __name__ == "__main__":
    seed_prizes()