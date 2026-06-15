from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models import models
from app.api.endpoints.auth import get_current_user, get_current_user_optional, get_current_admin

router = APIRouter()

class GuessCreate(BaseModel):
    match_id: int
    guess_score_a: int
    guess_score_b: int

class FinalizeMatch(BaseModel):
    score_a: int
    score_b: int

@router.get("/matches")
def list_matches(db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(get_current_user_optional)):
    matches = db.query(models.WorldCupMatch).order_by(models.WorldCupMatch.id.asc()).all()
    now_utc = datetime.now(timezone.utc)
    
    result = []
    for match in matches:
        match_time_utc = match.match_time.astimezone(timezone.utc) if match.match_time.tzinfo else match.match_time.replace(tzinfo=timezone.utc)
        cutoff_passed = now_utc >= match_time_utc - timedelta(hours=1)
        
        guess = None
        if current_user:
            guess = db.query(models.WorldCupGuess).filter(
                models.WorldCupGuess.match_id == match.id,
                models.WorldCupGuess.user_id == current_user.id
            ).first()
            
        user_guess_data = None
        if guess:
            user_guess_data = {
                "id": guess.id,
                "guess_score_a": guess.guess_score_a,
                "guess_score_b": guess.guess_score_b,
                "is_correct": guess.is_correct,
                "reward_coupon_code": guess.reward_coupon_code,
                "is_processed": guess.is_processed
            }
            
        result.append({
            "id": match.id,
            "team_a": match.team_a,
            "team_b": match.team_b,
            "stadium": match.stadium,
            "match_time": match.match_time,
            "score_a": match.score_a,
            "score_b": match.score_b,
            "is_finalized": match.is_finalized,
            "is_unlocked": match.is_unlocked,
            "cutoff_passed": cutoff_passed,
            "user_guess": user_guess_data
        })
        
    return result

@router.post("/guess")
def place_guess(guess_in: GuessCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    match = db.query(models.WorldCupMatch).filter(models.WorldCupMatch.id == guess_in.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
        
    if not match.is_unlocked:
        raise HTTPException(status_code=400, detail="Este jogo ainda está bloqueado para palpites.")
        
    if match.is_finalized:
        raise HTTPException(status_code=400, detail="Este jogo já foi finalizado.")
        
    now_utc = datetime.now(timezone.utc)
    match_time_utc = match.match_time.astimezone(timezone.utc) if match.match_time.tzinfo else match.match_time.replace(tzinfo=timezone.utc)
    if now_utc >= match_time_utc - timedelta(hours=1):
        raise HTTPException(status_code=400, detail="Os palpites encerram 1 hora antes do início do jogo.")
        
    guess = db.query(models.WorldCupGuess).filter(
        models.WorldCupGuess.match_id == guess_in.match_id,
        models.WorldCupGuess.user_id == current_user.id
    ).first()
    
    if guess:
        guess.guess_score_a = guess_in.guess_score_a
        guess.guess_score_b = guess_in.guess_score_b
    else:
        guess = models.WorldCupGuess(
            match_id=guess_in.match_id,
            user_id=current_user.id,
            guess_score_a=guess_in.guess_score_a,
            guess_score_b=guess_in.guess_score_b
        )
        db.add(guess)
        
    db.commit()
    db.refresh(guess)
    return {"message": "Palpite salvo com sucesso!", "guess_id": guess.id}

@router.post("/matches/{match_id}/finalize")
def finalize_match(match_id: int, score_in: FinalizeMatch, db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    match = db.query(models.WorldCupMatch).filter(models.WorldCupMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
        
    match.score_a = score_in.score_a
    match.score_b = score_in.score_b
    match.is_finalized = True
    
    guesses = db.query(models.WorldCupGuess).filter(models.WorldCupGuess.match_id == match_id).all()
    for guess in guesses:
        is_correct = (guess.guess_score_a == score_in.score_a) and (guess.guess_score_b == score_in.score_b)
        guess.is_correct = is_correct
        guess.is_processed = True
        
        if is_correct:
            import uuid
            code = f"PALPITE-BR-{match_id}-{uuid.uuid4().hex[:6].upper()}"
            coupon = models.Coupon(
                code=code,
                discount_type="percentage",
                discount_value=10.0,
                valid_until=datetime.now(timezone.utc) + timedelta(days=30),
                is_active=True
            )
            db.add(coupon)
            guess.reward_coupon_code = code
            
    if match_id == 1:
        next_match = db.query(models.WorldCupMatch).filter(models.WorldCupMatch.id == 2).first()
        if next_match:
            next_match.is_unlocked = True
            
    db.commit()
    return {"message": "Jogo finalizado e palpites processados com sucesso!"}

@router.post("/matches/reset")
def reset_guesses_system(db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin)):
    # Clean guesses
    db.query(models.WorldCupGuess).delete()
    
    # Reset Matches
    match1 = db.query(models.WorldCupMatch).filter(models.WorldCupMatch.id == 1).first()
    if match1:
        match1.score_a = None
        match1.score_b = None
        match1.is_finalized = False
        match1.is_unlocked = True
        
    match2 = db.query(models.WorldCupMatch).filter(models.WorldCupMatch.id == 2).first()
    if match2:
        match2.score_a = None
        match2.score_b = None
        match2.is_finalized = False
        match2.is_unlocked = False
        
    db.commit()
    return {"message": "Sistema de palpites resetado para desenvolvimento."}
