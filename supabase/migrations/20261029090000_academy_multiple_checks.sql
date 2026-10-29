-- Expose every published lesson check without exposing grading questions or keys.
do $migration$
declare definition text; marker text := 'order by position limit 1),''progress'''; replacement text;
begin
 definition := pg_get_functiondef('public.aa_base_action(bigint,text,jsonb)'::regprocedure);
 replacement := $sql$order by position limit 1),'assessments',(select coalesce(jsonb_agg(jsonb_build_object('code',z.code,'title',z.title,'kind',z.data->>'kind','passing_score',coalesce(z.data->'passing_score','70'),'instructions',z.data->'instructions','quiz_result',(select jsonb_build_object('passed',true,'score',t.score) from aa_attempts t where t.user_id=p_actor and t.assessment_code=z.code and t.assessment_version=z.version and t.passed order by t.id desc limit 1)) order by z.position,z.code),'[]'::jsonb) from aa_nodes z where z.parent_code=v_code and z.kind='assessment' and z.state='published'),'progress'$sql$;
 if position(marker in definition)=0 then raise exception 'academy_multiple_checks_migration_conflict'; end if;
 execute replace(definition,marker,replacement);
end $migration$;
