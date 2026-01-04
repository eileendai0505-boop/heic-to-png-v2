import Icon from "@/components/icon";
import { Section as SectionType } from "@/types/blocks/section";

export default function Feature({ section }: { section: SectionType }) {
  if (section.disabled) {
    return null;
  }

  return (
    <section id={section.name} className="pt-16 pb-16 bg-blue-50/30">
      <div className="container">
        <div className="mx-auto flex max-w-(--breakpoint-md) flex-col items-center gap-2 text-center">
          <h2 className="mb-2 text-pretty text-3xl font-bold lg:text-4xl">
            {section.title}
          </h2>
          <p className="mb-8 max-w-xl text-muted-foreground lg:max-w-none lg:text-lg">
            {section.description}
          </p>
        </div>
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {section.items?.map((item, i) => (
            <div key={i} className="flex flex-col">
              {item.icon && (
                <div className="mb-5 flex size-16 items-center justify-center rounded-full border" style={{ borderColor: '#489aee' }}>
                  {item.icon.startsWith('/') || item.icon.endsWith('.svg') ? (
                    <img src={item.icon} alt={item.title} className="size-8" style={{ filter: 'invert(47%) sepia(96%) saturate(3283%) hue-rotate(201deg) brightness(101%) contrast(101%)' }} />
                  ) : (
                    <div style={{ color: '#489aee' }}>
                      <Icon name={item.icon} className="size-8" />
                    </div>
                  )}
                </div>
              )}
              <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
