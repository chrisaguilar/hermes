update auth.issued_user_tokens iut set fk_user_id = $1::bigint 
  where iut.id = $2::text
   RETURNING id, fk_user_id;
