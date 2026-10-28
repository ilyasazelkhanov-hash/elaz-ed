import { ChevronRight } from 'lucide-react'
import courses from '../../../content/ai-academy/course-directory.json'
import type { AcademyEntity } from '../../lib/academy-types'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { LearningCourseCard } from '../courses/CourseCard'

/** A short native OG preview, with the full catalog in its own labeled tab. */
export function MainCourses(){
 const {push,setTab}=useStore.getState()
 return <section aria-label="Курсы">
  <div className="mb-3 flex items-center justify-between px-5"><h2 className="font-display text-lg font-semibold">Курсы</h2><Tap className="flex min-h-11 items-center gap-1 text-sm font-semibold text-violet" onClick={()=>setTab('courses')}>Все курсы<ChevronRight size={16}/></Tap></div>
  <div className="no-bar flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-4">{(courses.slice(0,3) as AcademyEntity[]).map(course=><LearningCourseCard key={course.code} course={course} compact onClick={()=>push({type:'learning',path:`/courses/${course.code}`})}/>)}</div>
 </section>
}
