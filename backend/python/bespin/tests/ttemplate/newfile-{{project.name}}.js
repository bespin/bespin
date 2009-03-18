// {{project.name}}
// Created by {{project.owner.username}} (who likes the number {{answer}})
// Who also has:
{% for proj in project.owner.projects %}
// {{proj.name}}
{%- endfor %}

alert("Welcome to {{project.name}}");
