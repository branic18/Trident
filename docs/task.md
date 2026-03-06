I want you to create a Node Package Vulnerability Visualizer VSCode Extension that uses npm audit on the backend to use the JSON payload it returns to map out package vulnerabilities. All information initially loaded comes from this JSON payload.

How to Visualize

To visualize use the following in the following ways based on the JSON payload:

- ‘effects’- take this information to visualize the blast radius of the vulnerable package
- ‘dependency’- use this to visualize dependencies
- ‘nodes’- use this to show duplication and explain nested dependency chains

Needed calculations:

- CVSS Algorithm- if CVSS string (cvss.vectorString) exists do 2 things:
    - Use CVSS score to determine the node color (look at Node Styling)
    - Use CVSS metrics to determine severity for each vulnerability
        - Use cvss-v3.1-base-metrics.json file for the key to translate the letters after CVSS:3.1/ within `cvss.vectorString`
    - If the CVSS string does not exist use the npm severity as fallback for that vulnerability (located within ‘via’ named ‘severity’)
- If there’s a detected change to the package.json the backend should automatically re-run the ‘npm audit —json’ to see if anything changed with the vulnerabilities

Node Styling:

- All Text: IBM Plex Mono, Regular 16
- For listing dependency and vulnerability count, the text should be #F7F7F7 and they should each be in their own frames black backgrounds, content fitted width, centered within their frames, 5px space left and right, 1px space top and bottom. These 2 should be listed as ex: ‘Dep: 0’ in one frame and ‘Vul: 2’ in another frame. These should be right beside the package name
- Critical
    - Background: #B40E0E
    - Package Name Text: #F7F7F7
    - Bootstrap Icon Name: exclamation-octagon-fill 1
    - Icon color: #F7F7F7
- High
    - Background: #F16621
    - Package Name Text: #000000
    - Bootstrap Icon Name: warning
    - Icon color: #000000
- Moderate
    - Background: #F19E21
    - Package Name Text: #000000
    - Bootstrap Icon Name: triangle 2
    - Icon color: #000000
- Low
    - Background: #285AFF
    - Package Name Text: #F7F7F7
    - Bootstrap Icon Name: circle 1
    - Icon color: #F7F7F7

Canvas components: The canvas should be located within a tab within VSCode (similar to a standard file being listed in the tabs). All of these canvas components exist within this tab.

- Node
    - Every item in the node is listed left to right, width is fitted to content
    - Color: should be according to the node severity
    - Order: Node icon, library name, number of other packages that depend on this vulnerable package count, vulnerabilities the package brings count. Ex: ‘<icon> Ajv Dep: 2, Vul: 3’
    - Variants:
        - Selected, Transitive Dependency: regular color and order as above
        - Selected, Direct Dependency: a blue border (#0678CF, 5px, solid) surrounding the node with 20px space all around the node; the node should be centered
- Inspector Panel
    - Color: #252526
    - Left stroke: 5px, solid, color (the same as the node that was selected)
    - Note: There should be a string to the selected node to overtly show the connection
    - 50% width of the canvas
    - Details:
        - Direct dependency or Transitive dependency
        - Package name
        - Close button top right hand corner
        - Border: #F7F7F7, 50% opacity
        - Vulnerability section title with count- ex: “3 Vulnerabilities”
        - Vulnerability card (all of these items are listed vertically):
            - Border: #F7F7F7, 35% opacity
            - Reference with ID and url hyperlinked in ID number- Ex: “REFERENCE: 1113428” (#BBBBBB, Regular, 15)
            - Vulnerability title (Bold, 20)
            - Summary (Regular, 15)
            - Severity block (4 columns, Titles never change, but the values do):
                - All titles here are:  (#BBBBBB, Regular, 14)
                - All values here are:  (#F7F7F7, Regular 15)
                - Column #1: Vertical stack
                    - Title (top)- ‘Severity’
                    - Value (bottom)- CVSS Score: Ex: “5.3 (Moderate)”
                        - NOTE: If cvss score is “0”, use the ‘severity’ property within ‘via’ instead and just say the word, ex “Moderate”. This should still correspond with the node styling.
                - Column #2:
                    - Title (top)- ‘Attack Vector’  (#BBBBBB, Regular, 14)
                    - Value (bottom)- Ex: ‘Network’
                - Column #3:
                    - Title (top)- ‘Privileges Required’
                    - Value (bottom)- Ex: ‘None’
                - Column #4:
                    - Title (top)- ‘User Interaction’
                    - Value (bottom)- Ex: ‘None’
            - Remediation block (3 columns)
                - Background: #1A1A1A
                - Border: #F7F7F7, 20% opacity
                - Column #1 (vertical, top to bottom):
                    - Property 1: Fix Available
                    - Value 1: “Yes”
                    - Property 2: Upgrade To:
                    - Value 2: “7.3.1”
                - Column #2:
                    - Property 1: Type
                    - Value 1: “SemVer Major”
                    - Property 2: Resolves
                    - Value 2: “2 vulnerabilities”
                - Column #3:
                    - Command copy component: #21252E, Regular, 12 (Ex: “nvm install ajv 7.3.1”) with copy icon (#F7F7F7) on the right side
            - Accordion (boneless, no background or borders)
                - Title: “Weakness Classification (CWE)”, Regular 18
                - Icon: Chevron down at the very right
                - Expanding this shows each CWE detail which includes:
                    - CWE Title with number (#BBBBBB, Regular 15): Ex- “CWE 1333: Insufficient Regular Expression Complexity”
                    - Impact (Bold Italic, 14): Ex- “***DoS: Resource Consumption (CPU)”***
                    - Summary (Regular, 14): Ex- “The product uses a search pattern (called a “regular expression”) that isn’t written efficiently. In some cases, it can take way longer than expected to process certain inputs, making the system work much harder than it should and use up too much CPU power.”
- Metadata
    - This should be in the top right corner of the canvas
    - Display the metadata object using the following examples:
        - 4 Vulnerabilities (Regular, 14)
            - 0 Info (Regular, 12)
            - 0 Low
            - 3 Moderate
            - 1 High
            - 0 Critical
        - 322 Dependencies (Regular, 14)
            - 18 prod
            - 279 dev
            - 75 optional
            - 0 peer
            - 0 peer optional
    - There should be a background that is 25px spaced around the metadata. Should have a frosted background
- Zoom in and zoom out controls:
    - Plus and minus icons within 2 separate icon buttons; stacked vertically

User Journey:

1. User enters a command ‘Vulnerability Package Scanner’ to open the View within Explorer
2. If no project is opened the View opens to show this text: “In order to use scanning features, you can open a Node project folder.” there should be a button underneath with the CTA ‘Open Folder’ letting the user open a local file to get started
3. If there wasn’t a scan completed (or found) within the project folder the View opens to show this text: “In order to use scanning features, start a vulnerability scan.” there should be a button underneath with the CTA ‘Start Scan’ which will take the user’s package.json file, run ‘npm audit —json’ in the background to return the results via a JSON payload to be mapped and displayed via the canvas file that will appear within a View titled ‘VULNERABLE PACKAGES’
4. User clicks the canvas file within the View (VSCode extension component) to view the canvas. The View should be titled ‘VULNERABLE PACKAGES’
5. User views the canvas to see the relationships (follow the ‘How to Visualize’ section for more details on what this should look like)
6. User clicks a node and it opens up the inspector panel with package details for that selected node.
7. If the user copies and pastes the suggested fix into the terminal (i.e. updating a package verison), a change to the package.json should be detected and the node graph should be updated
8. If there’s no command suggestion to fix the vulnerable package replace Column #3 text in the Remediation Block with a hyperlink to the vulnerable package to resolve. Therefore replacing the current node details with the selected hyperlinked details (as well as the node that’s shown and linked to on the left)
9. If the user resolved all vulnerabilities (i.e. the exit code on the backend returns with 0) there should be no graph file within view. Within the View there should only be text that says ‘No vulnerable packages detected’. But if a change is detected, like a user downloading a new package the text should change to: “In order to use scanning features, start a vulnerability scan.” there should be a button underneath with the CTA ‘Start Scan’

User interactions:

- View:
    - If there’s an available npm audit fix using a CTA button and put it within View under the canvas file that says ‘Auto-fix available’. The text above it should say
- Canvas:
    - Metadata:
        - User can read the metadata from the `metadata` object that contains ‘vulnerabilities’ and ‘dependencies’ as objects- Format should be <number key>, ex: for dependencies if it says “prod: 18”, in the canvas it should say “18 prod”
    - Canvas:
        - User can zoom in and zoom out via trackpad or zoom in and out controls on the bottom left side of the canvas
    - Node:
        - User clicks node, opens the node details in the Inspector panel on the right side, while centering the node on the left in the left space of the canvas (beside the inspector panel)
    - Inspector panel:
        - Auto-fix button: trigger `npm audit fix` on the backend for the user and resolve whatever npm audit fix can resolve
        - Manual fix: Suggest a command to copy and paste so the user can fix the vulnerable package

Other important items: 

- Icons- Bootstrap icon library
- Font: IBM Plex Mono
- The title for vulnerabilities should be based on the number to determine whether it’s singular or plural, ex: “1 Vulnerability” vs “5 Vulnerabilities”
- Summary for each vulnerability should be 3 lines max
- If the user zooms out to where the text is less than ex: 14px, then the typical node design should be a circle and should have the name of the library in gray hovering over the node and staying that same size as the user zooms further out as long as the library name inside of the node is less than 14px

Connect the dots to how to populate each item listed above using the JSON payload, if it was’t explicitly described above
