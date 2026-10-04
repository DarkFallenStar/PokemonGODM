from typing import Optional, List
from pydantic import BaseModel, Field

class PokemonTypeModel(BaseModel):
    id: int
    name: str
    color_hex: str

class MoveModel(BaseModel):
    name: str
    type_name: str
    category: str # 'fast' | 'charged'
    power: int = 0
    energy_delta: int = 0
    duration_ms: int = 1000

class PokemonScrapedModel(BaseModel):
    id: int = Field(..., ge=1, le=151)
    name: str
    type_primary: str
    type_secondary: Optional[str] = None
    hp: int
    attack: int
    defense: int
    sp_attack: int
    sp_defense: int
    speed: int
    base_cp: int = 10
    base_catch_rate: float = 0.20
    sprite_remote_url: str
    animation_remote_url: str
    sprite_url: Optional[str] = None
    animation_url: Optional[str] = None
    moves: List[str] = []

    def calculate_cp(self, iv_atk: int = 0, iv_def: int = 0, iv_hp: int = 0) -> int:
        """
        Fórmula matemática oficial de Pokémon GO:
        CP = max(10, floor((Total Attack * sqrt(Total Defense) * sqrt(Total Stamina)) / 10))
        """
        total_atk = self.attack + iv_atk
        total_def = self.defense + iv_def
        total_hp = self.hp + iv_hp
        import math
        calculated = math.floor((total_atk * math.sqrt(total_def) * math.sqrt(total_hp)) / 10)
        return max(10, calculated)
