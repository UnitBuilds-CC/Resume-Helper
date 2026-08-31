// Job board scraper service
// Supports multiple job boards: Remote OK, We Work Remotely, etc.

interface JobPosting {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  posted_date?: string;
  tags?: string[];
}

// Remote OK API
export async function scrapeRemoteOK(search?: string): Promise<JobPosting[]> {
  const url = 'https://remoteok.com/api';
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ResumeHelper/1.0' }
    });
    const data = await response.json();
    
    // Skip first item (it's not a job)
    let jobs = data.slice(1).map((job: any) => ({
      title: job.position || 'Unknown Position',
      company: job.company || 'Unknown Company',
      location: job.location || 'Remote',
      description: job.description || '',
      url: job.url || '',
      source: 'Remote OK',
      posted_date: job.date ? new Date(job.date).toISOString() : undefined,
      tags: job.tags || [],
    }));
    
    if (search) {
      const searchLower = search.toLowerCase();
      jobs = jobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.company.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return jobs;
  } catch (error) {
    console.error('Error scraping Remote OK:', error);
    return [];
  }
}

// We Work Remotely RSS
export async function scrapeWeWorkRemotely(category?: string): Promise<JobPosting[]> {
  const url = category
    ? `https://weworkremotely.com/categories/${category}/rss`
    : 'https://weworkremotely.com/categories/remote-back-end-programmer-jobs/rss';
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // Simple RSS parsing (in production, use a proper RSS parser)
    const jobs: JobPosting[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const description = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
      
      // Extract company from title (format: "Company: Position")
      const companyMatch = title.match(/^(.*?):\s*(.*)$/);
      const company = companyMatch ? companyMatch[1] : 'Unknown';
      const title_only = companyMatch ? companyMatch[2] : title;
      
      jobs.push({
        title: title_only,
        company,
        location: 'Remote',
        description: description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').replace(/<[^>]*>/g, ''),
        url: link,
        source: 'We Work Remotely',
        posted_date: pubDate ? new Date(pubDate).toISOString() : undefined,
      });
    }
    
    return jobs;
  } catch (error) {
    console.error('Error scraping We Work Remotely:', error);
    return [];
  }
}

// RustJobs.com
export async function scrapeRustJobs(search?: string): Promise<JobPosting[]> {
  const url = 'https://www.rustjobs.com';
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ResumeHelper/1.0' }
    });
    const html = await response.text();
    
    const jobs: JobPosting[] = [];
    
    // Parse job listings - structure is:
    // <li><ul>
    //   <li><a href="...">Title</a></li>
    //   <li>Company: Location</li>
    //   <li>Salary</li>
    //   <li>Description...</li>
    // </ul></li>
    const jobBlockRegex = /<li>\s*<ul>([\s\S]*?)<\/ul>\s*<\/li>/g;
    let blockMatch;
    
    while ((blockMatch = jobBlockRegex.exec(html)) !== null) {
      const block = blockMatch[1];
      
      // Extract title and URL
      const titleMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
      if (!titleMatch) continue;
      
      const url = titleMatch[1];
      const title = titleMatch[2].trim();
      
      // Extract remaining list items
      const items = block.match(/<li>([^<]+)<\/li>/g) || [];
      
      let company = 'Unknown';
      let location = 'Remote';
      let salary = '';
      let description = '';
      
      // Parse each item (skip the first one which is the title link)
      for (let i = 0; i < items.length; i++) {
        const text = items[i].replace(/<[^>]*>/g, '').trim();
        
        if (i === 0) {
          // Company: Location format
          const colonIndex = text.indexOf(':');
          if (colonIndex > 0) {
            company = text.substring(0, colonIndex).trim();
            location = text.substring(colonIndex + 1).trim();
          } else {
            company = text;
          }
        } else if (i === 1) {
          // Salary
          if (text.includes('$') || text.toLowerCase().includes('salary') || text.toLowerCase().includes('k')) {
            salary = text;
          } else {
            description = text;
          }
        } else if (i === 2) {
          // Description
          description = text;
        }
      }
      
      jobs.push({
        title,
        company,
        location,
        description: salary ? `${salary}\n\n${description}` : description,
        url: url.startsWith('http') ? url : `https://www.rustjobs.com${url}`,
        source: 'RustJobs',
        tags: ['rust'],
      });
    }
    
    let filteredJobs = jobs;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredJobs = jobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.company.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower)
      );
    }
    
    return filteredJobs;
  } catch (error) {
    console.error('Error scraping RustJobs:', error);
    return [];
  }
}

// Hacker News Who is Hiring
export async function scrapeHNWhoIsHiring(search?: string): Promise<JobPosting[]> {
  // Get the latest "Who is hiring" thread
  // These are posted monthly on the first working day
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Try current month first, then go back
  let threadId: string | null = null;
  
  for (let i = 0; i < 3; i++) {
    const monthIndex = (currentMonth - i + 12) % 12;
    const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
    const searchQuery = `site:news.ycombinator.com "who is hiring" ${months[monthIndex]} ${year}`;
    
    try {
      // Use HN search API
      const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent('Who is hiring')}&tags=ask_hn&numericFilters=created_at_i>${Math.floor(Date.now()/1000) - 7776000}`;
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data.hits && data.hits.length > 0) {
        threadId = data.hits[0].objectID;
        break;
      }
    } catch (error) {
      console.error('Error searching HN:', error);
    }
  }
  
  if (!threadId) {
    return [];
  }
  
  try {
    // Fetch the thread comments
    const url = `https://hn.algolia.com/api/v1/items/${threadId}`;
    const response = await fetch(url);
    const data = await response.json();
    
    const jobs: JobPosting[] = [];
    
    // Parse job comments - they typically start with "Company | Role | Location | Remote/Onsite"
    if (data.children) {
      for (const comment of data.children) {
        if (!comment.text) continue;
        
        const text = comment.text;
        
        // Check if it looks like a job posting (has pipe delimiters in first line)
        const firstLine = text.split('\n')[0];
        if (!firstLine.includes('|')) continue;
        
        const parts = firstLine.split('|').map(p => p.trim());
        if (parts.length < 2) continue;
        
        const company = parts[0] || 'Unknown';
        const title = parts[1] || 'Software Engineer';
        const location = parts[2] || 'Remote';
        const extra = parts[3] || '';
        
        // Check if it mentions Rust
        const fullText = text.toLowerCase();
        const mentionsRust = fullText.includes('rust');
        
        // Extract salary if present
        const salaryMatch = text.match(/(\$[\d,]+k?(?:\s*-\s*\$?[\d,]+k?)?)/i);
        const salary = salaryMatch ? salaryMatch[1] : '';
        
        // Get URL if present
        const urlMatch = text.match(/https?:\/\/[^\s<>"']+/);
        const jobUrl = urlMatch ? urlMatch[0] : `https://news.ycombinator.com/item?id=${comment.id}`;
        
        jobs.push({
          title: mentionsRust ? title : `${title} (may include Rust)`,
          company,
          location: location + (extra ? ` | ${extra}` : ''),
          description: text.substring(0, 500) + (salary ? `\n\nSalary: ${salary}` : ''),
          url: jobUrl,
          source: 'HN Who is Hiring',
          tags: mentionsRust ? ['rust', 'hn'] : ['hn'],
          posted_date: comment.created_at ? new Date(typeof comment.created_at === 'number' ? comment.created_at * 1000 : comment.created_at).toISOString() : undefined,
        });
      }
    }
    
    let filteredJobs = jobs;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredJobs = jobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.company.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    } else {
      // Show all jobs but prioritize Rust-related ones
      filteredJobs = jobs.sort((a, b) => {
        const aRust = a.tags?.includes('rust') || a.description.toLowerCase().includes('rust');
        const bRust = b.tags?.includes('rust') || b.description.toLowerCase().includes('rust');
        if (aRust && !bRust) return -1;
        if (!aRust && bRust) return 1;
        return 0;
      });
    }
    
    return filteredJobs;
  } catch (error) {
    console.error('Error scraping HN Who is Hiring:', error);
    return [];
  }
}

// Stack Overflow Jobs (deprecated, but keeping for reference)
export async function scrapeStackOverflow(search?: string): Promise<JobPosting[]> {
  // Stack Overflow Jobs API is deprecated
  // This is a placeholder for future implementation
  return [];
}

// Let's Get Rusty job board
export async function scrapeLetsGetRusty(search?: string): Promise<JobPosting[]> {
  const jobs: JobPosting[] = [];
  const totalPages = 21; // Site has 207 jobs across 21 pages
  
  try {
    for (let page = 1; page <= totalPages; page++) {
      const url = `https://jobs.letsgetrusty.com/?page=${page}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ResumeHelper/1.0' }
      });
      const html = await response.text();
      
      // Parse JSON-LD structured data
      const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
      let match;
      
      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(match[1]);
          
          // Handle both single job and item list
          const jobList = data['@type'] === 'ItemList' ? data.itemListElement : [data];
          
          for (const item of jobList) {
            const job = item.item || item;
            
            if (job['@type'] !== 'JobPosting') continue;
            
            const title = job.title || 'Unknown Position';
            const company = job.hiringOrganization?.name || 'Unknown Company';
            const description = job.description || '';
            const jobUrl = job.url || '';
            const postedDate = job.datePosted;
            
            // Extract location
            const location = job.jobLocation?.address?.addressCountry || 
                            job.applicantLocationRequirements?.name ||
                            'Remote';
            
            // Determine if worldwide remote
            const isRemote = location.toLowerCase() === 'remote' || 
                            job.jobLocation?.address?.addressCountry === 'Remote';
            const isWorldwide = isRemote && (
              !location || 
              location.toLowerCase() === 'remote' ||
              location.toLowerCase().includes('worldwide') ||
              location.toLowerCase().includes('global')
            );
            
            // Extract salary
            let salary = '';
            if (job.baseSalary?.value) {
              const min = job.baseSalary.value.minValue || job.baseSalary.value.value;
              const max = job.baseSalary.value.maxValue;
              const currency = job.baseSalary.currency || 'USD';
              if (min && max) {
                salary = `${currency}${min} - ${currency}${max}`;
              } else if (min) {
                salary = `${currency}${min}+`;
              }
            }
            
            // Extract industry
            const industry = job.industry || '';
            const experienceLevel = job.experienceRequirements || '';
            
            // Only include remote jobs
            if (isRemote) {
              jobs.push({
                title,
                company,
                location: isWorldwide ? 'Remote (Worldwide)' : `Remote (${location})`,
                description: description.substring(0, 500) + (salary ? `\n\nSalary: ${salary}` : '') + (industry ? `\n\nIndustry: ${industry}` : '') + (experienceLevel ? `\n\nExperience: ${experienceLevel}` : ''),
                url: jobUrl,
                source: "Let's Get Rusty",
                tags: ['rust'],
                posted_date: postedDate ? new Date(postedDate).toISOString() : undefined,
              });
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
    
    let filteredJobs = jobs;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredJobs = jobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.company.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return filteredJobs;
  } catch (error) {
    console.error('Error scraping Let\'s Get Rusty:', error);
    return [];
  }
}

// Generic scraper that tries multiple sources
export async function findJobs(search?: string, sources: string[] = ['remoteok', 'weworkremotely', 'rustjobs', 'hnwhohiring', 'letsgerrusty']): Promise<JobPosting[]> {
  const allJobs: JobPosting[] = [];
  
  for (const source of sources) {
    switch (source.toLowerCase()) {
      case 'remoteok':
        allJobs.push(...await scrapeRemoteOK(search));
        break;
      case 'weworkremotely': {
        let jobs = await scrapeWeWorkRemotely();
        if (search) {
          const searchLower = search.toLowerCase();
          jobs = jobs.filter(job => 
            job.title.toLowerCase().includes(searchLower) ||
            job.company.toLowerCase().includes(searchLower) ||
            job.description.toLowerCase().includes(searchLower) ||
            job.tags?.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }
        allJobs.push(...jobs);
        break;
      }
      case 'rustjobs':
        allJobs.push(...await scrapeRustJobs(search));
        break;
      case 'hnwhohiring':
      case 'hn':
      case 'hackernews':
        allJobs.push(...await scrapeHNWhoIsHiring(search));
        break;
      case 'letsgerrusty':
      case 'letgetrusty':
        allJobs.push(...await scrapeLetsGetRusty(search));
        break;
    }
  }
  
  return allJobs;
}
